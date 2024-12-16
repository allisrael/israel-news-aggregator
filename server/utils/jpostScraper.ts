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
    // Try multiple RSS feed URLs in order of preference
    const rssUrls = [
      'https://www.jpost.com/rss/rssfeedsfrontpage.aspx',
      'https://www.jpost.com/rss/rss.aspx?sectionid=1',
      'https://www.jpost.com/Rss/RssFeedsHeadlines.aspx',
      'https://www.jpost.com/rss/rssfeedsmanager.aspx',
      // Additional backup URLs and proxies
      'https://rss.app/feeds/rVeDbUWxLDf0Uk2M.xml',
      'https://feed.informer.com/digests/KGPQFPNPIK/feeder',
      'https://feedmix.novaclic.com/atom2rss.php?source=https%3A%2F%2Fwww.jpost.com%2Frss'
    ];
    
    let response;
    let lastError;

    for (const url of rssUrls) {
      try {
        console.log(`Trying feed URL: ${url}`);
        response = await axios.get(url, {
          timeout: 30000,
          maxRedirects: 5,
          responseType: 'text',
          validateStatus: (status) => status < 500,
          headers: {
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });

        if (response.status === 200) {
          console.log(`Successfully fetched feed from ${url}`);
          break;
        }

        console.log(`Failed to fetch from ${url}: ${response.status}`);
        lastError = new Error(`HTTP ${response.status}`);
      } catch (err) {
        const error = err as Error;
        console.log(`Error fetching from ${url}:`, error.message);
        lastError = error;
        continue;
      }
    }

    if (!response || response.status !== 200) {
      throw lastError || new Error('Failed to fetch feed from all URLs');
    }

    const xmlContent = response.data;
    if (typeof xmlContent !== 'string' || xmlContent.length === 0) {
      throw new Error('Invalid RSS feed response: Empty content');
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseTagValue: true,
      isArray: (name) => ['item', 'Tags', 'RelatedItemID1', 'RelatedItemID2', 'RelatedItemID3'].includes(name),
      textNodeName: "#text",
      removeNSPrefix: true,
      preserveOrder: false,
      ignoreDeclaration: true,
      parseAttributeValue: false,
      cdataPropName: "__cdata",
      numberParseOptions: {
        hex: false,
        leadingZeros: false
      },
      tagValueProcessor: (tagName: string, tagValue: any) => {
        if (typeof tagValue === 'string') {
          return tagValue
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&#x2018;/g, "'")
            .replace(/&#x2019;/g, "'")
            .trim();
        }
        return tagValue;
      }
    });

    console.log(`RSS Feed Content Length: ${xmlContent.length}`);
    const result = parser.parse(xmlContent);

    if (!result?.rss?.channel?.item) {
      throw new Error('Invalid RSS feed structure - missing channel or items');
    }

    const items = Array.isArray(result.rss.channel.item) 
      ? result.rss.channel.item 
      : [result.rss.channel.item];

    if (!items.length) {
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
        
        // Extract category from Tags if available
        const category = item.Tags?.split(',')[0]?.trim() || 'News';
        
        // Create the article with English content as default and Hebrew translation if available
        const article: JPostArticle = {
          titleHe: item.title?.trim() || '',
          titleEn: item.SocialTitle?.trim() || item.title?.trim() || '',
          url: item.link?.trim() || '',
          contentHe: item.title?.trim() || '', // Use title as Hebrew content for now
          contentEn: cleanDescription || '',
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
    let jpostArticles;
    try {
      jpostArticles = await scrapeLatestJPostArticles();
    } catch (error) {
      console.error('Failed to scrape JPost articles:', error);
      throw new Error(`Failed to scrape JPost articles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    if (!jpostArticles || jpostArticles.length === 0) {
      console.warn('No articles found to import from JPost');
      return 0;
    }
    
    let importedCount = 0;
    for (const article of jpostArticles) {
      try {
        if (!article.url || !article.titleHe || !article.contentHe) {
          console.warn('Skipping invalid article:', {
            hasUrl: !!article.url,
            hasTitleHe: !!article.titleHe,
            hasContentHe: !!article.contentHe
          });
          continue;
        }

        // Check for existing article to avoid duplicates
        const existing = await db.query.articles.findFirst({
          where: eq(articles.url, article.url)
        });

        if (existing) {
          console.log(`Skipping duplicate article: ${article.titleHe}`);
          continue;
        }

        console.log('Attempting to insert article:', {
          title: article.titleHe.substring(0, 50),
          url: article.url,
          source: article.source,
          category: article.category
        });

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
        console.log(`Successfully imported article: ${article.titleHe}`);
      } catch (err) {
        console.error('Failed to import article:', {
          title: article.titleHe,
          error: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined
        });
      }
    }

    console.log(`Import completed. Successfully imported ${importedCount} articles`);
    return importedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error importing JPost articles:', {
      message: errorMessage,
      stack: errorStack
    });
    throw error;
  }
}
