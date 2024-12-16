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
    const rssUrl = 'https://rss.jpost.com/rss/rssfeedsfrontpage.aspx';
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: true,
      trimValues: true,
      parseTagValue: true,
      isArray: (name) => ['item'].includes(name),
      textNodeName: "#text",
      removeNSPrefix: true,
      preserveOrder: false,
      ignoreDeclaration: true,
      parseAttributeValue: false,
      cdataPropName: "#cdata"
    });
    
    const response = await axios.get(rssUrl, {
      timeout: 30000,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: null,
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.status !== 200) {
      console.error('Failed to fetch RSS feed:', response.status, response.statusText);
      throw new Error(`Failed to fetch RSS feed: HTTP ${response.status}`);
    }

    const xmlContent = response.data;
    if (typeof xmlContent !== 'string' || xmlContent.length === 0) {
      console.error('Invalid RSS feed response: Empty content');
      throw new Error('Invalid RSS feed response: Empty content');
    }

    console.log(`RSS Feed Content Length: ${xmlContent.length}`);
    console.log('First 200 characters:', xmlContent.substring(0, 200));

    const result = parser.parse(xmlContent);
    console.log('Parsed RSS feed structure:', JSON.stringify(result, null, 2).substring(0, 1000));

    if (!result?.rss?.channel?.item) {
      console.error('Invalid RSS feed structure:', result);
      throw new Error('Invalid RSS feed structure - missing channel or items');
    }

    const items = Array.isArray(result.rss.channel.item) 
      ? result.rss.channel.item 
      : [result.rss.channel.item];

    if (!items.length) {
      console.error('No items found in feed');
      throw new Error('No items found in RSS feed');
    }

    console.log(`Found ${items.length} items in feed`);
    
    const articles = items.map((item: any) => {
      try {
        // Extract the image URL from the description HTML
        const $ = cheerio.load(item.description || '');
        const imgElement = $('img');
        const imageUrl = imgElement.attr('src');
        
        // Clean up the description by removing the image HTML
        imgElement.remove();
        const cleanDescription = $.text().trim();

        // Extract tags and convert to a category
        const tags = item.Tags?.split(',') || [];
        const primaryTag = tags[0] || 'News';
        
        const article: JPostArticle = {
          titleEn: item.title?.trim() || '',
          contentEn: cleanDescription,
          source: 'The Jerusalem Post',
          category: primaryTag,
          imageUrl: imageUrl || null,
          sourceUrl: item.link?.trim() || '',
        };

        // Validate required fields
        if (!article.titleEn || !article.contentEn || !article.sourceUrl) {
          console.warn('Skipping invalid article:', { 
            hasTitle: !!article.titleEn,
            hasContent: !!article.contentEn,
            hasUrl: !!article.sourceUrl
          });
          return null;
        }

        console.log('Successfully processed article:', {
          title: article.titleEn.substring(0, 50) + '...',
          link: article.sourceUrl,
          hasImage: !!article.imageUrl,
          category: article.category
        });
        
        return article;
      } catch (error) {
        console.error('Error processing RSS item:', error);
        console.debug('Problematic RSS item:', JSON.stringify(item, null, 2));
        return null;
      }
    });

    // Filter out null articles and take the latest 6 valid ones
    const validArticles = articles
      .filter((article): article is JPostArticle => article !== null)
      .slice(0, 6);

    console.log(`Successfully processed ${validArticles.length} valid articles`);
    return validArticles;
  } catch (error) {
    console.error('Error scraping JPost:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
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