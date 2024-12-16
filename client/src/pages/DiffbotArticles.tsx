import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "wouter";
import { format } from "date-fns";

interface DiffbotArticle {
  id: number;
  url: string;
  title: string;
  content: string;
  siteName: string;
  publishedAt: string;
  imageUrl: string | null;
  categories: Array<{ name: string; score: number }>;
}

export function DiffbotArticles() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/diffbot-articles"],
    queryFn: async () => {
      const response = await fetch("/api/diffbot-articles");
      if (!response.ok) throw new Error("Failed to fetch articles");
      return response.json() as Promise<DiffbotArticle[]>;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Imported Articles</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-96 bg-white rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Imported Articles</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.map((article) => (
          <Card key={article.id} className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
            {article.imageUrl && (
              <div className="relative h-48 bg-gray-100">
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="object-cover w-full h-full"
                />
                {article.categories?.[0] && (
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 text-sm bg-primary text-white rounded-md">
                      {article.categories[0].name}
                    </span>
                  </div>
                )}
              </div>
            )}
            <CardHeader className="space-y-3">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{article.siteName}</span>
                  {article.publishedAt && (
                    <>
                      <span>•</span>
                      <span>{format(new Date(article.publishedAt), 'PPP')}</span>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-2 text-gray-600">
                <p className="line-clamp-3">{article.content}</p>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Read Original Article
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
