import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Share2, Bookmark, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/LanguageContext";
import { type Article } from "@/lib/api";

export function ArticleDetail() {
  const [, params] = useRoute("/article/:id");
  const { language } = useLanguage();
  const isHebrew = language === "he";

  const { data: article, isLoading } = useQuery({
    queryKey: [`/api/articles/${params?.id}`],
    enabled: !!params?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto animate-pulse">
          <CardHeader className="h-8 bg-gray-200 rounded mb-4" />
          <CardContent className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardContent className="py-8">
            <p className="text-center text-gray-500">Article not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const title = isHebrew ? article.titleHe : (article.titleEn || article.titleHe);
  const content = isHebrew ? article.contentHe : (article.contentEn || article.contentHe);

  return (
    <div className="min-h-screen container mx-auto px-4 py-8">
      <Card className="w-full max-w-4xl mx-auto">
        {article.imageUrl && (
          <div className="relative h-64 md:h-96 bg-gray-100">
            <img
              src={article.imageUrl}
              alt={title}
              className="object-cover w-full h-full"
            />
          </div>
        )}
        <CardHeader className="space-y-4">
          <div className="flex justify-between items-start gap-4">
            <h1 
              className={`text-3xl font-bold ${isHebrew ? "text-right" : "text-left"}`}
              dir={isHebrew ? "rtl" : "ltr"}
            >
              {title}
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" title="Share">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" title="Save">
                <Bookmark className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" title="Read Later">
                <Clock className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{article.source}</span>
            <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div 
            className={`${isHebrew ? "text-right" : "text-left"} space-y-6`}
            dir={isHebrew ? "rtl" : "ltr"}
          >
            {content.split('\n').map((paragraph, i) => (
              <div key={i} className="text-lg leading-relaxed text-gray-700">
                {paragraph}
              </div>
            ))}
          </div>
          <div className="mt-8 pt-8 border-t">
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <div>
                <span className="font-semibold mr-2">Source:</span>
                <span className="mr-2">{article.source}</span>
                {article.sourceUrl && (
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    {isHebrew ? 'צפה במקור' : 'View Original Article'}
                  </a>
                )}
              </div>
              <div>
                <span className="font-semibold mr-2">Category:</span>
                {article.category}
              </div>
              <div>
                <span className="font-semibold mr-2">Published:</span>
                {new Date(article.publishedAt).toLocaleDateString(
                  isHebrew ? 'he-IL' : 'en-US',
                  { 
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
