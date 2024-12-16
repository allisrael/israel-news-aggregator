import { useState } from "react";
import { useArticles, useCategories } from "@/lib/api";
import { ArticleCard } from "@/components/ArticleCard";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/LanguageContext";

export function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>();
  const { language } = useLanguage();
  
  const { data: articles, isLoading } = useArticles({ search, category });
  const { data: categories = [] } = useCategories();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">
              {language === "he" ? "מצבור חדשות ישראל" : "Israeli News Aggregator"}
            </h1>
            <LanguageSwitcher />
          </div>
          <SearchBar 
            value={search} 
            onChange={setSearch}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <CategoryFilter
            categories={categories}
            selected={category}
            onSelect={setCategory}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-96 bg-white rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles?.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
