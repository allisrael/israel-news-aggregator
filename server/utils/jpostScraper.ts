import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@db';
import { articles } from '@db/schema';
import { eq } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';

interface JPostArticle {
  titleEn: string;
  contentEn: string;
  source: string;
  category: string;
  imageUrl: string | null;
  sourceUrl: string;
}

export async function scrapeLatestJPostArticles(): Promise<JPostArticle[]> {
  try {
        console.log('Fetching articles from JPost RSS feed...');
        
        const rssUrls = [
          'https://www.jpost.com/Rss/RssFeedsHeadlines.aspx',
          'https://www.jpost.com/Rss/RssFeedsIsraelNews.aspx',
          'https://www.jpost.com/Rss/RssFeedsMiddleEastNews.aspx',
          'https://www.jpost.com/Rss/RssFeedsFrontPage.aspx'
        ];
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: true,
      trimValues: true,
      parseTagValue: true,
      isArray: (name) => ['item', 'category'].indexOf(name) !== -1,
      textNodeName: "_text",
      ignoreNameSpace: true,
      removeNSPrefix: true
    });
    
    let allArticles: JPostArticle[] = [];
    
    for (const rssUrl of rssUrls) {
      try {
        console.log(`Fetching RSS feed: ${rssUrl}`);
        const response = await axios.get(rssUrl, {
          timeout: 30000,
          maxRedirects: 5,
          decompress: true,
          responseType: 'text',
          validateStatus: (status) => status >= 200 && status < 300,
          headers: {
            'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml; q=0.9, */*; q=0.8',
            'User-Agent': 'Mozilla/5.0 (compatible; IsraeliNewsAggregator/1.0; +https://replit.com)',
            'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive'
          }
        });

        if (response.status !== 200) {
          console.error(`Failed to fetch RSS feed ${rssUrl}: HTTP ${response.status}`);
          continue;
        }

        const xmlContent = response.data;
        console.log(`RSS Feed Content Length: ${xmlContent.length}`);
        console.log(`RSS Feed Content Sample: ${xmlContent.substring(0, 200)}`);

        if (!xmlContent.includes('<rss') && !xmlContent.includes('<feed')) {
          console.error(`Invalid feed format from ${rssUrl}`);
          continue;
        }

        const result = parser.parse(xmlContent);
        console.log('Parsed RSS structure:', JSON.stringify(result, null, 2).substring(0, 500));
        
        if (!result?.rss?.channel) {
          console.error(`Invalid RSS feed structure from ${rssUrl}`);
          continue;
        }

        const channel = result.rss.channel;
        console.log(`Channel Title: ${channel.title?._text || channel.title}`);
        console.log(`Channel Description: ${channel.description?._text || channel.description}`);
        
        const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
        console.log(`Found ${items.length} items in feed ${rssUrl}`);

        const feedArticles = items.map((item: any) => {
          // Extract title and content
          const title = item.title?._text || item.title;
          const description = item.description?._text || item.description;
          
          // Extract image URL from media:content, media:thumbnail, or enclosure
          let imageUrl = null;
          if (item['media:content']) {
            imageUrl = item['media:content']['@_url'];
          } else if (item['media:thumbnail']) {
            imageUrl = item['media:thumbnail']['@_url'];
          } else if (item.enclosure) {
            const type = item.enclosure['@_type'];
            if (type && type.startsWith('image/')) {
              imageUrl = item.enclosure['@_url'];
            }
          }

          // Extract category
          let category = 'News';
          if (item.category) {
            if (Array.isArray(item.category)) {
              category = item.category[0]?._text || item.category[0];
            } else {
              category = item.category._text || item.category;
            }
          } else if (rssUrl.includes('defense')) {
            category = 'Defense';
          } else if (rssUrl.includes('israelnews')) {
            category = 'Israel News';
          }

          // Extract link
          const link = item.link?._text || item.link;
          console.log(`Processed article: ${title} - ${link}`);

          return {
            titleEn: title,
            contentEn: description || 'Read full article on The Jerusalem Post website',
            source: 'The Jerusalem Post',
            category,
            imageUrl,
            sourceUrl: link,
          };
        });

        allArticles = [...allArticles, ...feedArticles];
        
        // Log success for this feed
        console.log(`Successfully parsed ${feedArticles.length} articles from ${rssUrl}`);
      } catch (error) {
        console.error(`Error fetching RSS feed ${rssUrl}:`, error);
        // Continue with other feeds even if one fails
        continue;
      }
    }

    // Take only the latest 6 articles
    allArticles = allArticles
      .filter(article => article.titleEn && article.sourceUrl)
      .slice(0, 6);

    console.log(`Final article count: ${allArticles.length}`);
    return allArticles;
  } catch (error) {
    console.error('Error scraping JPost:', error);
    throw error;
  }
}

export async function importJPostArticles() {
  try {
    console.log('Starting JPost article import...');
    const jpostArticles = await scrapeLatestJPostArticles();
    
    if (jpostArticles.length === 0) {
      console.warn('No articles found to import from JPost');
      return 0;
    }
    
    // Insert articles into database
    let importedCount = 0;
    for (const article of jpostArticles) {
      try {
        // Check if article already exists to avoid duplicates
        const existing = await db.query.articles.findFirst({
          where: eq(articles.sourceUrl, article.sourceUrl)
        });

        if (existing) {
          console.log(`Skipping duplicate article: ${article.titleEn}`);
          continue;
        }

        await db.insert(articles).values({
          titleEn: article.titleEn,
          titleHe: '',  // We'll need translation service for Hebrew
          contentEn: article.contentEn,
          contentHe: '',  // We'll need translation service for Hebrew
          source: article.source,
          category: article.category,
          imageUrl: article.imageUrl,
          sourceUrl: article.sourceUrl,
          publishedAt: new Date(),
          metadata: {},
        });
        
        importedCount++;
        console.log(`Imported article: ${article.titleEn}`);
      } catch (err) {
        console.error(`Failed to import article ${article.titleEn}:`, err);
      }
    }

    console.log(`Successfully imported ${importedCount} articles`);
    return importedCount;
  } catch (error) {
    console.error('Error importing JPost articles:', error);
    throw error;
  }
}