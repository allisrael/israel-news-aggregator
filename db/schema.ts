import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  titleHe: text("title_he").notNull(),
  titleEn: text("title_en"),
  url: text("url").notNull().unique(),
  contentHe: text("content_he").notNull(),
  contentEn: text("content_en"),
  source: text("source").notNull(),
  category: text("category").notNull().default('News'),
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  publishedAt: timestamp("published_at").notNull(),
});

export const diffbotArticles = pgTable("diffbot_articles", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  html: text("html"),
  author: text("author"),
  siteName: text("site_name"),
  estimatedDate: timestamp("estimated_date"),
  publishedAt: timestamp("published_at"),
  imageUrl: text("image_url"),
  icon: text("icon"),
  language: text("language"),
  sentiment: text("sentiment"),
  tags: jsonb("tags"),
  categories: jsonb("categories"),
  images: jsonb("images"),
  rawData: jsonb("raw_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type DiffbotArticle = typeof diffbotArticles.$inferSelect;
export type NewDiffbotArticle = typeof diffbotArticles.$inferInsert;

export const insertArticleSchema = createInsertSchema(articles);
export const selectArticleSchema = createSelectSchema(articles);
export const insertDiffbotArticleSchema = createInsertSchema(diffbotArticles);
export const selectDiffbotArticleSchema = createSelectSchema(diffbotArticles);
