import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { db } from '@db';
import { articles } from '@db/schema';
import { eq } from 'drizzle-orm';

interface TOIArticle {
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

export async function scrapeLatestTOIArticles(): Promise<TOIArticle[]> {
  try {
    console.log('Fetching articles from Times of Israel RSS feed...');
    // Try multiple feed URL formats including mobile version
    const feedUrls = [
      'https://www.timesofisrael.com/feed',
      'https://m.timesofisrael.com/feed/',
      'https://www.timesofisrael.com/israel-news/feed/',
      'https://blogs.timesofisrael.com/feed/',
      'https://www.timesofisrael.com/start-up-israel/feed/',
      'https://www.timesofisrael.com/rss/',
      // RSS proxies and alternative formats
      'https://rss.app/feeds/O6LJpwNyxnb3YDKJ.xml',
      'https://feed.informer.com/digests/KGPQFPNPIK/feeder',
      'https://feedmix.novaclic.com/atom2rss.php?source=https%3A%2F%2Fwww.timesofisrael.com%2Ffeed'
    ];

    // Helper function to delay between requests
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseTagValue: true,
      isArray: (name) => ['item', 'category'].includes(name),
      textNodeName: "#text",
      removeNSPrefix: true,
      preserveOrder: false,
      ignoreDeclaration: true,
      parseAttributeValue: false,
      numberParseOptions: {
        hex: false,
        leadingZeros: false
      },
      tagValueProcessor: (tagName, tagValue) => {
        if (typeof tagValue === 'string') {
          return tagValue.trim();
        }
        return tagValue;
      }
    });

    let response;
    let lastError;

    // Try each URL with exponential backoff
    for (let i = 0; i < feedUrls.length; i++) {
      const url = feedUrls[i];
      try {
        // Add delay between requests with exponential backoff
        if (i > 0) {
          const backoffTime = Math.min(1000 * Math.pow(2, i - 1), 8000);
          console.log(`Waiting ${backoffTime}ms before next attempt...`);
          await delay(backoffTime);
        }
        
        console.log(`Trying feed URL: ${url}`);
        try {
          console.log(`Attempting to fetch RSS feed from ${url}`);
          response = await axios.get(url, {
            timeout: 30000,
            maxRedirects: 5,
            responseType: 'text',
            validateStatus: (status) => status < 500, // Accept all status codes less than 500
            headers: {
              'Accept': 'application/rss+xml, application/xml, text/xml, */*',
              'Accept-Encoding': 'gzip, deflate',
              'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            decompress: true // Handle gzip responses
          });

          console.log(`Response status: ${response.status}, content type: ${response.headers['content-type']}`);
        } catch (error) {
          if (axios.isAxiosError(error)) {
            console.error(`Axios error for ${url}:`, {
              status: error.response?.status,
              statusText: error.response?.statusText,
              headers: error.response?.headers,
              message: error.message
            });
          }
          throw error;
        }


        if (response.status === 200) {
          console.log(`Successfully fetched feed from ${url}`);
          break;
        }

        console.log(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
        lastError = new Error(`HTTP ${response.status}`);
      } catch (err) {
        const error = err as Error;
        console.log(`Error fetching from ${url}:`, error.message);
        lastError = error;
      }
    }

    if (!response || response.status !== 200) {
      throw lastError || new Error('Failed to fetch feed from all URLs');
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
    
    const articles = items.map((item: Record<string, any>) => {
      try {
        // Extract image URL from description HTML if present
        const imgMatch = item.description?.match(/<img[^>]+src="([^">]+)"/);
        const imageUrl = imgMatch ? imgMatch[1] : null;
        
        // Clean description by removing HTML tags
        const cleanDescription = item.description?.replace(/<[^>]+>/g, '').trim() || '';
        const categories = Array.isArray(item.category) 
          ? item.category[0]?.trim() 
          : (item.category?.trim() || 'News');
        
        const article: TOIArticle = {
          titleHe: item.title?.trim() || '',
          titleEn: null,
          url: item.guid?.trim() || item.link?.trim() || '',
          contentHe: cleanDescription,
          contentEn: null,
          source: 'Times of Israel',
          category: categories,
          imageUrl: imageUrl,
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

        console.log('Successfully processed article:', {
          titleHe: article.titleHe.substring(0, 50) + '...',
          url: article.url,
          category: article.category,
          publishedAt: article.publishedAt.toISOString()
        });
        
        return article;
      } catch (error) {
        console.error('Error processing RSS item:', error);
        return null;
      }
    });

    // Filter out null articles and take the latest 10 valid ones
    const validArticles = articles
      .filter((article: TOIArticle | null): article is TOIArticle => article !== null)
      .slice(0, 10);

    console.log(`Successfully processed ${validArticles.length} valid articles`);
    return validArticles;
  } catch (error) {
    console.error('Error scraping Times of Israel:', error);
    throw error;
  }
}

export async function importTOIArticles() {
  try {
    console.log('Starting Times of Israel article import...');
    const toiArticles = await scrapeLatestTOIArticles();
    
    if (toiArticles.length === 0) {
      console.warn('No articles found to import from Times of Israel');
      return 0;
    }
    
    let importedCount = 0;
    for (const article of toiArticles) {
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
    console.error('Error importing Times of Israel articles:', error);
    throw error;
  }
}