import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { type Article } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { Link } from "wouter";

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const { language } = useLanguage();
  const isHebrew = language === "he";

  const title = isHebrew ? article.titleHe : (article.titleEn || article.titleHe);
  const content = isHebrew ? article.contentHe : (article.contentEn || article.contentHe);

  return (
    <Link href={`/article/${article.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
        {article.imageUrl && (
          <div className="relative h-48 bg-gray-100">
            <img
              src={article.imageUrl}
              alt={title}
              className="object-cover w-full h-full"
            />
          </div>
        )}
        <CardHeader className="space-y-2">
          <div className="space-y-1">
            <h3 
              className={`text-xl font-bold ${isHebrew ? "text-right" : "text-left"}`} 
              dir={isHebrew ? "rtl" : "ltr"}
            >
              {title}
            </h3>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{article.source}</span>
            <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p 
            className={isHebrew ? "text-right" : "text-left"}
            dir={isHebrew ? "rtl" : "ltr"}
          >
            {/* Show first 3 paragraphs of content */}
            {content.split('\n').slice(0, 3).map((paragraph, i) => (
              <p key={i} className="mb-2">
                {paragraph}
              </p>
            ))}
            {content.split('\n').length > 3 && (
              <p className="text-primary font-medium">Read more...</p>
            )}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}