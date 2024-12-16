import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { db } from '@db';
import { articles } from '@db/schema';
import { eq } from 'drizzle-orm';

interface JPostArticle {
  title: string;
  url: string;
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
      parseAttributeValue: false
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

    // Debug the parsed structure
    console.log('RSS Feed Structure:', JSON.stringify({
      hasRss: !!result.rss,
      hasChannel: !!result.rss?.channel,
      itemCount: result.rss?.channel?.item?.length || 0
    }));

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
        const article: JPostArticle = {
          title: item.title?.trim() || '',
          url: item.link?.trim() || '',
          publishedAt: new Date(item.pubDate)
        };

        // Validate required fields
        if (!article.title || !article.url) {
          console.warn('Skipping invalid article:', { 
            title: article.title?.substring(0, 50),
            hasUrl: !!article.url
          });
          return null;
        }

        console.log('Successfully processed article:', {
          title: article.title.substring(0, 50) + '...',
          url: article.url
        });
        
        return article;
      } catch (error) {
        console.error('Error processing RSS item:', error);
        return null;
      }
    });

    // Filter out null articles and take the latest 10 valid ones
    const validArticles = articles
      .filter((article): article is JPostArticle => article !== null)
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
          console.log(`Skipping duplicate article: ${article.title}`);
          continue;
        }

        await db.insert(articles).values({
          title: article.title,
          url: article.url,
          publishedAt: article.publishedAt,
        });
        
        importedCount++;
        console.log(`Imported article: ${article.title}`);
      } catch (err) {
        console.error(`Failed to import article "${article.title}":`, err);
      }
    }

    console.log(`Successfully imported ${importedCount} articles`);
    return importedCount;
  } catch (error) {
    console.error('Error importing JPost articles:', error);
    throw error;
  }
}