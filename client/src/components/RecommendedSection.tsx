import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, BookOpen, Plus, RefreshCw, Star, Loader2, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { motion } from "framer-motion";

type BookInfo = {
  id: number | null;
  title: string;
  author: string;
  coverUrl: string | null;
  averageRating: number;
  genre: string | null;
} | null;

type Suggestion = {
  title: string;
  author: string;
  reason: string;
  book: BookInfo;
};

// ── Skeleton card (mesmo formato do card real) ──────────────────────────
function SkeletonCard() {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border bg-card">
      <Skeleton className="w-16 h-24 rounded-md flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export default function RecommendedSection() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const suggestReading = trpc.ai.suggestReading.useMutation();
  const importBook = trpc.bookSearch.importBook.useMutation();
  const addToReadingList = trpc.readingList.add.useMutation();
  const utils = trpc.useUtils();

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const result = await suggestReading.mutateAsync();
      setSuggestions(result.suggestions ?? []);
    } catch {
      setError(true);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [suggestReading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchSuggestions();
  }, [isAuthenticated, fetchSuggestions]);

  // Importa um livro via Google Books e retorna o ID local
  const importFromGoogleBooks = async (suggestion: Suggestion) => {
    const q = encodeURIComponent(`${suggestion.title} ${suggestion.author}`);
    const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`);
    if (!googleRes.ok) throw new Error("Falha na busca do Google Books");
    const googleData = await googleRes.json() as any;
    const item = googleData.items?.[0];
    if (!item) throw new Error("Livro não encontrado no Google Books");
    const vol = item.volumeInfo ?? {};
    const isbn = (vol.industryIdentifiers ?? []).find((i: any) => i.type === "ISBN_13")?.identifier
      ?? (vol.industryIdentifiers ?? []).find((i: any) => i.type === "ISBN_10")?.identifier;
    const result = await importBook.mutateAsync({
      title: vol.title ?? suggestion.title,
      author: (vol.authors ?? [suggestion.author])[0],
      description: vol.description,
      coverUrl: vol.imageLinks?.thumbnail?.replace("http://", "https://"),
      isbn,
      publishedYear: vol.publishedDate ? parseInt(vol.publishedDate.slice(0, 4)) : undefined,
      publisher: vol.publisher,
      pageCount: vol.pageCount,
      genre: (vol.categories ?? [])[0],
    });
    return { result, vol };
  };

  // Botão "Ver livro": se existe no banco, navega; senão, importa via Google Books e redireciona
  const handleViewBook = async (suggestion: Suggestion, idx: number) => {
    if (suggestion.book && suggestion.book.id != null) {
      navigate(`/book/${suggestion.book.id}`);
      return;
    }
    setImportingId(idx);
    toast.info(`Buscando "${suggestion.title}" no Google Books...`);
    try {
      const { result } = await importFromGoogleBooks(suggestion);
      toast.success(`Livro importado com sucesso!`);
      navigate(`/book/${result.id!}`);
    } catch {
      toast.error(`Não foi possível encontrar "${suggestion.title}"`);
    } finally {
      setImportingId(null);
    }
  };

  // Botão "Adicionar à lista": abre seletor de status
  const handleAddToList = async (suggestion: Suggestion, status: "want_to_read" | "reading" | "read") => {
    const key = `${suggestion.title}-${suggestion.author}`;
    setAddingId(key);
    const statusLabel = status === "want_to_read" ? "Quero Ler" : status === "reading" ? "Lendo" : "Lido";
    try {
      if (suggestion.book && suggestion.book.id != null) {
        await addToReadingList.mutateAsync({
          bookId: suggestion.book.id,
          status,
        });
        toast.success(`Adicionado à lista: ${statusLabel}`);
        utils.readingList.get.invalidate();
      } else {
        // Importar primeiro, depois adicionar
        const { result, vol } = await importFromGoogleBooks(suggestion);
        await addToReadingList.mutateAsync({
          bookId: result.id!,
          status,
        });
        toast.success(`"${vol.title ?? suggestion.title}" importado e adicionado: ${statusLabel}`);
        utils.readingList.get.invalidate();
        // Atualizar a sugestão local com o book info
        setSuggestions(prev => prev.map(s =>
          s.title === suggestion.title && s.author === suggestion.author
            ? {
                ...s,
                book: {
                  id: result.id,
                  title: vol.title ?? suggestion.title,
                  author: (vol.authors ?? [suggestion.author])[0],
                  coverUrl: vol.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
                  averageRating: 0,
                  genre: (vol.categories ?? [])[0] ?? null,
                },
              }
            : s
        ));
      }
    } catch {
      toast.error("Erro ao adicionar à lista");
    } finally {
      setAddingId(null);
    }
  };

  if (!isAuthenticated) return null;

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.23, 1, 0.32, 1] as const,
      },
    },
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground font-serif">Recomendado para você</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary"
          onClick={fetchSuggestions}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error || suggestions.length === 0 ? (
        <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-border bg-secondary/30">
          <div className="text-center space-y-2">
            <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Não conseguimos gerar recomendações</p>
            <p className="text-xs text-muted-foreground/70">Tente novamente em alguns momentos</p>
          </div>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {suggestions.map((suggestion, idx) => {
            const isImporting = importingId === idx;
            const isAdding = addingId === `${suggestion.title}-${suggestion.author}`;
            return (
              <motion.div
                key={`${suggestion.title}-${suggestion.author}-${idx}`}
                variants={cardVariants}
              >
                <div className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200 h-full">
                  {/* Capa do livro */}
                  <div className="flex-shrink-0">
                    {suggestion.book?.coverUrl ? (
                      <img
                        src={suggestion.book.coverUrl}
                        alt={suggestion.title}
                        className="w-16 h-24 rounded-md object-cover shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-24 bg-secondary rounded-md flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Conteúdo do card */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold font-serif text-foreground line-clamp-2 leading-tight">
                        {suggestion.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{suggestion.author}</p>
                      {suggestion.book?.averageRating ? (
                        <div className="flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs text-muted-foreground">
                            {suggestion.book.averageRating.toFixed(1)}
                          </span>
                          {suggestion.book.genre && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 ml-1">
                              {suggestion.book.genre}
                            </Badge>
                          )}
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground/80 italic leading-relaxed line-clamp-2">
                        &ldquo;{suggestion.reason}&rdquo;
                      </p>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs gap-1"
                        onClick={() => handleViewBook(suggestion, idx)}
                        disabled={isImporting}
                      >
                        {isImporting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <BookOpen className="h-3 w-3" />
                        )}
                        Ver livro
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 h-7 text-xs gap-0.5"
                            disabled={isAdding}
                          >
                            {isAdding ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            Adicionar à lista
                            <ChevronDown className="h-2.5 w-2.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() => handleAddToList(suggestion, "want_to_read")}
                          >
                            Quero Ler
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() => handleAddToList(suggestion, "reading")}
                          >
                            Lendo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() => handleAddToList(suggestion, "read")}
                          >
                            Lido
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-2">
        Recomendações personalizadas baseadas no seu histórico de leitura
      </p>
    </section>
  );
}
