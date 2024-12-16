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
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
        {article.imageUrl && (
          <div className="relative h-48 bg-gray-100">
            <img
              src={article.imageUrl}
              alt={title}
              className="object-cover w-full h-full"
            />
            <div className="absolute top-2 right-2">
              <span className="px-2 py-1 text-sm bg-primary text-white rounded-md">
                {article.category}
              </span>
            </div>
          </div>
        )}
        <CardHeader className="space-y-3">
          <div className="space-y-2">
            <h3 
              className={`text-xl font-bold ${isHebrew ? "text-right" : "text-left"}`} 
              dir={isHebrew ? "rtl" : "ltr"}
            >
              {title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium">{article.source}</span>
              <span>•</span>
              <span>{new Date(article.publishedAt).toLocaleDateString(
                isHebrew ? 'he-IL' : 'en-US',
                { 
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }
              )}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div 
            className={`prose max-w-none ${isHebrew ? "text-right" : "text-left"}`}
            dir={isHebrew ? "rtl" : "ltr"}
          >
            {content.split('\n').slice(0, 3).map((paragraph, i) => (
              <p key={i} className="mb-2 text-gray-600">
                {paragraph}
              </p>
            ))}
            {content.split('\n').length > 3 && (
              <p className="text-primary font-medium mt-4">
                {isHebrew ? 'קרא עוד...' : 'Read more...'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}