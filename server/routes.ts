import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { articles } from "@db/schema";
import { eq, like, desc, and } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  // Get articles with filtering
  app.get("/api/articles", async (req, res) => {
    try {
      const { category, search, page = 1, limit = 10 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      
      let query = db.select().from(articles).orderBy(desc(articles.publishedAt));
      
      if (category) {
        query = query.where(eq(articles.category, String(category)));
      }
      
      if (search) {
        query = query.where(
          and(
            like(articles.titleHe, `%${search}%`),
            like(articles.titleEn, `%${search}%`)
          )
        );
      }
      
      const results = await query.limit(Number(limit)).offset(offset);
      res.json(results);
    } catch (error) {
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

  const httpServer = createServer(app);
  return httpServer;
}
