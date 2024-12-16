import { Button } from "@/components/ui/button";

interface CategoryFilterProps {
  categories: string[];
  selected: string | undefined;
  onSelect: (category: string | undefined) => void;
}

export function CategoryFilter({ 
  categories, 
  selected, 
  onSelect 
}: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <Button
        variant={!selected ? "default" : "outline"}
        onClick={() => onSelect(undefined)}
      >
        All
      </Button>
      {categories.map((category) => (
        <Button
          key={category}
          variant={selected === category ? "default" : "outline"}
          onClick={() => onSelect(category)}
        >
          {category}
        </Button>
      ))}
    </div>
  );
}
