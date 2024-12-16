import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@db';
import { articles } from '@db/schema';

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
    const response = await axios.get(`${baseUrl}/israel-news`);
    const $ = cheerio.load(response.data);
    const articles: JPostArticle[] = [];

    // Get the first 6 articles from the main content area
    $('.article-card').slice(0, 6).each((_, element) => {
      const articleEl = $(element);
      const titleEl = articleEl.find('.article-title');
      const link = titleEl.find('a').attr('href');
      const sourceUrl = link ? `${baseUrl}${link}` : '';
      const imageEl = articleEl.find('img');

      const article: JPostArticle = {
        titleEn: titleEl.text().trim(),
        contentEn: articleEl.find('.article-excerpt').text().trim(),
        source: 'The Jerusalem Post',
        category: 'News',  // We'll get more specific category later
        imageUrl: imageEl.attr('src') || null,
        sourceUrl,
      };

      articles.push(article);
    });

    return articles;
  } catch (error) {
    console.error('Error scraping JPost:', error);
    throw error;
  }
}

export async function importJPostArticles() {
  try {
    const jpostArticles = await scrapeLatestJPostArticles();
    
    // Insert articles into database
    for (const article of jpostArticles) {
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
      });
    }

    return jpostArticles.length;
  } catch (error) {
    console.error('Error importing JPost articles:', error);
    throw error;
  }
}
