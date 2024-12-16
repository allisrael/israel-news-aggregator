import { useQuery } from "@tanstack/react-query";

export type Article = {
  id: number;
  titleHe: string;
  titleEn: string | null;
  contentHe: string;
  contentEn: string | null;
  source: string;
  category: string;
  imageUrl: string | null;
  publishedAt: string;
};

export interface ArticlesResponse {
  articles: Article[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function useArticles(params: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery({
    queryKey: ["/api/articles", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.category) searchParams.set("category", params.category);
      if (params.search) searchParams.set("search", params.search);
      if (params.page) searchParams.set("page", params.page.toString());
      if (params.limit) searchParams.set("limit", params.limit.toString());
      if (params.fromDate) searchParams.set("fromDate", params.fromDate);
      if (params.toDate) searchParams.set("toDate", params.toDate);
      
      const response = await fetch(`/api/articles?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch articles");
      return response.json() as Promise<ArticlesResponse>;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json() as Promise<string[]>;
    },
  });
}
