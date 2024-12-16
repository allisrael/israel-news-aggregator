import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/LanguageContext";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="outline"
      onClick={() => setLanguage(language === "he" ? "en" : "he")}
      className="min-w-[80px]"
    >
      {language === "he" ? "English" : "עברית"}
    </Button>
  );
}
