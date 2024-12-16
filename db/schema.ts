import { pgTable, text, serial, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  titleHe: text("title_he").notNull(),
  titleEn: text("title_en"),
  url: text("url").notNull().unique(),
  contentHe: text("content_he").notNull(),
  contentEn: text("content_en"),
  source: text("source").notNull(),
  category: text("category"),
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  publishedAt: timestamp("published_at").notNull(),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

export const insertArticleSchema = createInsertSchema(articles);
export const selectArticleSchema = createSelectSchema(articles);
