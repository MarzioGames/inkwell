import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookOpen, Plus, Check, ExternalLink } from "lucide-react";
import { Link } from "wouter";

type ExternalBook = {
  externalId: string;
  source: "google" | "openlibrary";
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  isbn?: string;
  publishedYear?: number;
  publisher?: string;
  pageCount?: number;
  genre?: string;
};

export default function BookImportDialog({
  trigger,
  onImported,
}: {
  trigger?: React.ReactNode;
  onImported?: (bookId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: results, isLoading } = trpc.bookSearch.searchExternal.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 }
  );

  const importBook = trpc.bookSearch.importBook.useMutation();

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(value);
    }, 600);
  };

  const handleImport = async (book: ExternalBook) => {
    try {
      const data = await importBook.mutateAsync({
        title: book.title,
        author: book.author,
        description: book.description,
        coverUrl: book.coverUrl,
        isbn: book.isbn,
        publishedYear: book.publishedYear,
        publisher: book.publisher,
        pageCount: book.pageCount,
        genre: book.genre,
      });
      if (data.existed) {
        toast.info("Livro já cadastrado na plataforma");
      } else {
        toast.success("Livro importado com sucesso!");
      }
      setImportedIds(prev => { const next = new Set(prev); next.add(book.title); return next; });
      if (onImported && data.id != null) onImported(data.id);
    } catch {
      toast.error("Erro ao importar livro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Buscar Livros
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Buscar Livros</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Busca simultânea no Google Books e Open Library
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Título, autor ou ISBN..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Resultados */}
          <ScrollArea className="h-[400px] pr-1">
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg border border-border">
                    <Skeleton className="w-12 h-18 rounded flex-shrink-0" style={{ height: "72px" }} />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && searchQuery && results?.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum livro encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">Tente outros termos de busca</p>
              </div>
            )}

            {!searchQuery && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Digite para buscar livros</p>
                <p className="text-xs text-muted-foreground mt-1">Resultados do Google Books e Open Library</p>
              </div>
            )}

            {results && results.length > 0 && (
              <div className="space-y-2">
                {results.map((book: ExternalBook) => {
                  const isImported = importedIds.has(book.title);
                  return (
                    <div
                      key={`${book.source}-${book.externalId}`}
                      className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors"
                    >
                      {/* Capa */}
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-12 rounded object-cover flex-shrink-0 shadow-sm"
                          style={{ height: "72px" }}
                        />
                      ) : (
                        <div
                          className="w-12 rounded bg-secondary flex items-center justify-center flex-shrink-0"
                          style={{ height: "72px" }}
                        >
                          <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold font-serif text-foreground line-clamp-1">{book.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{book.author}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 h-4 ${
                              book.source === "google"
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                            }`}
                          >
                            {book.source === "google" ? "Google Books" : "Open Library"}
                          </Badge>
                          {book.publishedYear && (
                            <span className="text-xs text-muted-foreground">{book.publishedYear}</span>
                          )}
                          {book.pageCount && (
                            <span className="text-xs text-muted-foreground">{book.pageCount} págs.</span>
                          )}
                          {book.isbn && (
                            <span className="text-xs text-muted-foreground font-mono">ISBN: {book.isbn}</span>
                          )}
                        </div>
                        {book.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{book.description}</p>
                        )}
                      </div>

                      {/* Ação */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={isImported ? "outline" : "default"}
                          className="h-7 text-xs gap-1"
                          onClick={() => handleImport(book)}
                          disabled={importBook.isPending || isImported}
                        >
                          {isImported ? (
                            <><Check className="h-3 w-3" /> Importado</>
                          ) : (
                            <><Plus className="h-3 w-3" /> Importar</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
