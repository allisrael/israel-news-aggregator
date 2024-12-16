import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@db';
import { articles } from '@db/schema';
import { eq } from 'drizzle-orm';

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
    const baseUrl = 'https://www.jpost.com';
    console.log('Fetching articles from JPost...');
    
    // Try to fetch the home page first
    const response = await axios.get(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      },
      timeout: 30000
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch JPost: HTTP ${response.status}`);
    }

    console.log('Successfully fetched JPost page');
    const $ = cheerio.load(response.data);
    const articles: JPostArticle[] = [];

    // Try multiple selectors for articles
    const articleSelectors = [
      'div.article-card',
      'article.article',
      '.jpost-list article',
      '.main-container article',
      '.top-story',
      '.featured-article',
      '.article-item',
      '.breaking-news article'
    ];

    for (const selector of articleSelectors) {
      console.log(`Trying selector: ${selector}`);
      const elements = $(selector);
      console.log(`Found ${elements.length} elements with selector ${selector}`);

      elements.slice(0, 6).each((_, element) => {
        const articleEl = $(element);

        // Try multiple selectors for title
        const titleSelectors = ['h1', 'h2', 'h3', '.title', '.article-title', '[data-title]'];
        const titleEl = titleSelectors
          .map(sel => articleEl.find(sel).first())
          .find(el => el.length > 0 && el.text().trim());

        // Try multiple selectors for link with improved URL handling
        const linkSelectors = [
          'a[href*="/article/"]', 
          'a[href*="/israel-news/"]',
          'a[href*="/middle-east/"]',
          'a[href*="/breaking-news/"]',
          'a[href]:not([href="#"])'
        ];
        
        let sourceUrl = '';
        for (const selector of linkSelectors) {
          const linkEl = articleEl.find(selector).first();
          if (linkEl.length > 0) {
            const href = linkEl.attr('href');
            if (href) {
              sourceUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
              break;
            }
          }
        }

        // Try multiple selectors for image
        const imageSelectors = ['img[src*="images"]', 'img[data-src*="images"]', 'img[data-lazy-src]', '.article-image img'];
        const imageEl = imageSelectors
          .map(sel => articleEl.find(sel).first())
          .find(el => el.length > 0);

        // Try multiple selectors for excerpt
        const excerptSelectors = ['.excerpt', '.description', 'p:not(:empty)', '.article-content'];
        const excerpt = excerptSelectors
          .map(sel => articleEl.find(sel).first())
          .find(el => el.length > 0 && el.text().trim());

        if (!titleEl || !sourceUrl) {
          console.log('Skipping article due to missing data:', {
            hasTitle: !!titleEl,
            title: titleEl?.text().trim(),
            hasUrl: !!sourceUrl,
            url: sourceUrl
          });
          return;
        }

        const title = titleEl.text().trim();
        const content = excerpt?.text().trim() || '';

        // Only process articles with meaningful content
        if (title && sourceUrl && content.length > 20) {
          const article: JPostArticle = {
            titleEn: title,
            contentEn: content || 'Read full article on The Jerusalem Post website',
            source: 'The Jerusalem Post',
            category: articleEl.find('.category, .article-category, .section-title').text().trim() || 'News',
            imageUrl: imageEl?.attr('src') || imageEl?.attr('data-src') || imageEl?.attr('data-lazy-src') || null,
            sourceUrl,
          };

          // Log the successfully scraped article
          console.log('Successfully scraped article:', {
            title: article.titleEn,
            url: article.sourceUrl,
            contentLength: article.contentEn.length,
            hasImage: !!article.imageUrl
          });
          
          articles.push(article);
        }
      });

      // If we found any articles with this selector, stop trying other selectors
      if (articles.length > 0) {
        break;
      }
    }

    console.log(`Successfully scraped ${articles.length} articles from JPost`);
    return articles;
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