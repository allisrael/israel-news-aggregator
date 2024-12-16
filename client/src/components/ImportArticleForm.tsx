import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export function ImportArticleForm() {
  const [url, setUrl] = useState("");
  const { toast } = useToast();
  
  const importMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/import/diffbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Article imported successfully",
      });
      setUrl("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    importMutation.mutate(url);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <Input
        type="url"
        placeholder="Enter article URL to import..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        className="flex-1"
      />
      <Button 
        type="submit" 
        disabled={importMutation.isPending}
      >
        {importMutation.isPending ? "Importing..." : "Import Article"}
      </Button>
    </form>
  );
}
