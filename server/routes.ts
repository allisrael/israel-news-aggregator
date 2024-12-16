import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { articles, diffbotArticles } from "@db/schema";
import { eq, like, desc, and, or, gte, lte, sql } from "drizzle-orm";
import axios from "axios";

export function registerRoutes(app: Express): Server {
  // Get articles with filtering
  app.get("/api/articles", async (req, res) => {
    try {
      const { 
        category, 
        search, 
        page = 1, 
        limit = 10,
        fromDate,
        toDate
      } = req.query;
      
      const offset = (Number(page) - 1) * Number(limit);
      let conditions = [];
      
      if (category) {
        conditions.push(eq(articles.category, String(category)));
      }
      
      if (search) {
        conditions.push(
          or(
            like(articles.titleHe, `%${search}%`),
            like(articles.titleEn, `%${search}%`),
            like(articles.contentHe, `%${search}%`),
            like(articles.contentEn, `%${search}%`)
          )
        );
      }

      if (fromDate) {
        conditions.push(gte(articles.publishedAt, new Date(String(fromDate))));
      }

      if (toDate) {
        conditions.push(lte(articles.publishedAt, new Date(String(toDate))));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const [results, totalCount] = await Promise.all([
        db.select()
          .from(articles)
          .where(whereClause)
          .orderBy(desc(articles.publishedAt))
          .limit(Number(limit))
          .offset(offset),
        db.select({ count: sql`count(*)::int` })
          .from(articles)
          .where(whereClause)
          .then(result => result[0].count)
      ]);

      res.json({
        articles: results,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching articles:', error);
      res.status(500).json({ error: "Failed to fetch articles" });
    }
  });

  // Get article categories
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await db
        .selectDistinct({ category: articles.category })
        .from(articles);
      res.json(categories.map(c => c.category));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Get single article by ID
  app.get("/api/articles/:id", async (req, res) => {
    try {
      const article = await db.query.articles.findFirst({
        where: eq(articles.id, Number(req.params.id)),
      });
      
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      res.json(article);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  // Import Times of Israel articles
  app.post("/api/import/toi", async (req, res) => {
    try {
      const { importTOIArticles } = await import("./utils/toiScraper");
      const count = await importTOIArticles();
      res.json({ message: `Successfully imported ${count} articles from Times of Israel` });
    } catch (error) {
      console.error('Error importing Times of Israel articles:', error);
      res.status(500).json({ error: "Failed to import articles from Times of Israel" });
    }
  });

  // Import Jerusalem Post articles
  app.post("/api/import/jpost", async (req, res) => {
    try {
      const { importJPostArticles } = await import("./utils/jpostScraper");
      const count = await importJPostArticles();
      res.json({ message: `Successfully imported ${count} articles from Jerusalem Post` });
    } catch (error) {
      console.error('Error importing Jerusalem Post articles:', error);
      res.status(500).json({ error: "Failed to import articles from Jerusalem Post" });
    }
  });

  // Import Times of Israel articles
  app.post("/api/import/toi", async (req, res) => {
    try {
      const { importTOIArticles } = await import("./utils/toiScraper");
      const count = await importTOIArticles();
      res.json({ message: `Successfully imported ${count} articles from Times of Israel` });
    } catch (error) {
      console.error('Error importing Times of Israel articles:', error);
      res.status(500).json({ error: "Failed to import articles from Times of Israel" });
    }
  });

  // Import article using Diffbot
  // Get all Diffbot articles
  app.get("/api/diffbot-articles", async (_req, res) => {
    try {
      const articles = await db.query.diffbotArticles.findMany({
        orderBy: (diffbotArticles, { desc }) => [desc(diffbotArticles.createdAt)]
      });
      res.json(articles);
    } catch (error) {
      console.error('Error fetching Diffbot articles:', error);
      res.status(500).json({ error: "Failed to fetch Diffbot articles" });
    }
  });

  app.post("/api/import/diffbot", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Check if article already exists
      const existing = await db.query.diffbotArticles.findFirst({
        where: eq(diffbotArticles.url, url)
      });

      if (existing) {
        return res.status(409).json({ error: "Article already imported" });
      }

      // Check for Diffbot API key
      const diffbotApiKey = process.env.DIFFBOT_API_KEY;
      if (!diffbotApiKey) {
        return res.status(500).json({ error: "Diffbot API key not configured" });
      }

      // Call Diffbot API
      const diffbotUrl = `https://api.diffbot.com/v3/article?token=${diffbotApiKey}&url=${encodeURIComponent(url)}`;
      const response = await axios.get(diffbotUrl);
      console.log('Diffbot API Response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data || !response.data.objects || !response.data.objects[0]) {
        console.error('Invalid Diffbot response structure:', response.data);
        return res.status(400).json({ error: "Could not extract article content" });
      }
      
      const article = response.data.objects[0];

      // Insert into database
      await db.insert(diffbotArticles).values({
        url: url,
        title: article.title,
        content: article.text,
        html: article.html,
        author: article.author,
        siteName: article.siteName,
        estimatedDate: article.estimatedDate ? new Date(article.estimatedDate) : null,
        publishedAt: article.date ? new Date(article.date) : null,
        imageUrl: article.images?.[0]?.url,
        icon: article.icon,
        language: article.humanLanguage,
        sentiment: article.sentiment?.toString(),
        tags: article.tags || [],
        categories: article.categories || [],
        images: article.images || [],
        rawData: response.data
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error importing article:', error);
      res.status(500).json({ error: "Failed to import article" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}