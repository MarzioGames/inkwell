import { Link } from "wouter";
import { Star, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BookMentionCardProps {
  bookId: number;
  title: string;
  author: string;
  coverUrl?: string;
  rating: number;
  ratingCount: number;
}

export default function BookMentionCard({
  bookId,
  title,
  author,
  coverUrl,
  rating,
  ratingCount,
}: BookMentionCardProps) {
  return (
    <Link href={`/book/${bookId}`}>
      <div className="inline-flex items-center gap-3 p-3 bg-secondary/50 border border-primary/20 rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer my-2 max-w-sm">
        {/* Capa do livro */}
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="h-16 w-12 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-16 w-12 bg-background rounded flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-6 w-6 text-muted-foreground opacity-50" />
          </div>
        )}

        {/* Informações */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground truncate text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground truncate">{author}</p>
          
          {/* Rating */}
          <div className="flex items-center gap-1 mt-1">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < Math.round(rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-foreground">
              {rating.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({ratingCount})
            </span>
          </div>
        </div>

        {/* Botão */}
        <Button
          size="sm"
          variant="ghost"
          className="flex-shrink-0 h-8 w-8 p-0"
          onClick={(e) => {
            e.preventDefault();
          }}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Link>
  );
}
