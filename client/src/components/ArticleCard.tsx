import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { type Article } from "@/lib/api";

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {article.imageUrl && (
        <div className="relative h-48 bg-gray-100">
          <img
            src={article.imageUrl}
            alt={article.titleEn || article.titleHe}
            className="object-cover w-full h-full"
          />
        </div>
      )}
      <CardHeader className="space-y-2">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-right" dir="rtl">
            {article.titleHe}
          </h3>
          {article.titleEn && (
            <h4 className="text-lg text-gray-600">{article.titleEn}</h4>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{article.source}</span>
          <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-right mb-2" dir="rtl">
          {article.contentHe.slice(0, 150)}...
        </p>
        {article.contentEn && (
          <p className="text-gray-600">
            {article.contentEn.slice(0, 150)}...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
