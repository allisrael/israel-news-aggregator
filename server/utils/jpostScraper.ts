import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { db } from '@db';
import { articles } from '@db/schema';
import { eq } from 'drizzle-orm';

interface JPostArticle {
  titleHe: string;
  titleEn: string | null;
  url: string;
  contentHe: string;
  contentEn: string | null;
  source: string;
  category: string;
  imageUrl: string | null;
  sourceUrl: string;
  publishedAt: Date;
}

export async function scrapeLatestJPostArticles(): Promise<JPostArticle[]> {
  try {
    console.log('Fetching articles from JPost RSS feed...');
    const rssUrl = 'https://rss.jpost.com/rss/rssfeedsfrontpage.aspx';
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseTagValue: true,
      isArray: (name) => ['item'].includes(name),
      textNodeName: "#text",
      removeNSPrefix: true,
      preserveOrder: false,
      ignoreDeclaration: true,
      parseAttributeValue: false,
      numberParseOptions: {
        hex: false,
        leadingZeros: false
      }
    });
    
    const response = await axios.get(rssUrl, {
      timeout: 30000,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: null,
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'Mozilla/5.0 (compatible; IsraeliNewsBot/1.0)'
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
    const result = parser.parse(xmlContent);

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
    
    const articles = items.map((item: Record<string, any>) => {
      try {
        // Extract image URL from description HTML if present
        const imgMatch = item.description?.match(/<img[^>]+src="([^">]+)"/);
        const imageUrl = imgMatch ? imgMatch[1] : null;
        
        // Clean description by removing HTML tags
        const cleanDescription = item.description?.replace(/<[^>]+>/g, '').trim() || '';

        // Extract category from Tags or use default
        const category = item.Tags?.split(',')[0]?.trim() || 'News';
        
        const article: JPostArticle = {
          titleHe: item.title?.trim() || '',
          titleEn: null, // JPost is in English by default
          url: item.guid?.trim() || item.link?.trim() || '',
          contentHe: cleanDescription,
          contentEn: null,
          source: 'Jerusalem Post',
          category,
          imageUrl,
          sourceUrl: item.link?.trim() || '',
          publishedAt: new Date(item.pubDate || Date.now())
        };

        // Validate required fields
        if (!article.titleHe || !article.url || !article.contentHe) {
          console.warn('Skipping invalid article:', { 
            titleHe: article.titleHe?.substring(0, 50),
            hasUrl: !!article.url,
            hasContent: !!article.contentHe
          });
          return null;
        }

        return article;
      } catch (error) {
        console.error('Error processing RSS item:', error);
        return null;
      }
    });

    // Filter out null articles and take the latest 10 valid ones
    const validArticles = articles
      .filter((article: JPostArticle | null): article is JPostArticle => article !== null)
      .slice(0, 10);

    console.log(`Successfully processed ${validArticles.length} valid articles`);
    return validArticles;
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
    
    let importedCount = 0;
    for (const article of jpostArticles) {
      try {
        // Check for existing article to avoid duplicates
        const existing = await db.query.articles.findFirst({
          where: eq(articles.url, article.url)
        });

        if (existing) {
          console.log(`Skipping duplicate article: ${article.titleHe}`);
          continue;
        }

        await db.insert(articles).values({
          titleHe: article.titleHe,
          titleEn: article.titleEn,
          url: article.url,
          contentHe: article.contentHe,
          contentEn: article.contentEn,
          source: article.source,
          category: article.category,
          imageUrl: article.imageUrl,
          sourceUrl: article.sourceUrl,
          publishedAt: article.publishedAt,
        });
        
        importedCount++;
        console.log(`Imported article: ${article.titleHe}`);
      } catch (err) {
        console.error(`Failed to import article "${article.titleHe}":`, err);
      }
    }

    console.log(`Successfully imported ${importedCount} articles`);
    return importedCount;
  } catch (error) {
    console.error('Error importing JPost articles:', error);
    throw error;
  }
}
