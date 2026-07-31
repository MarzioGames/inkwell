import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CommunitiesSidebar from "@/components/CommunitiesSidebar";
import MobileCommunities from "@/components/MobileCommunities";
import PostCard from "@/components/PostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  BookOpen, TrendingUp, Sparkles, ChevronLeft, ChevronRight,
  Star, Flame, ArrowRight, Loader2, BookMarked, Hash
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

type SortOption = "hot" | "new" | "top";
import RecommendedSection from "@/components/RecommendedSection";
const PAGE_SIZE = 10;

// ── Carrossel de livros ──────────────────────────────────────────────────
function BookCarousel({ books }: { books: Array<{ id: number; title: string; author: string; coverUrl?: string | null; averageRating: number; genre?: string | null }> }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };
  if (!books.length) return (
    <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-border bg-secondary/30">
      <div className="text-center space-y-2">
        <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">Nenhum livro em destaque ainda</p>
        <p className="text-xs text-muted-foreground/70">Use o botão "Importar" na barra superior para adicionar livros</p>
      </div>
    </div>
  );
  return (
    <div className="relative group">
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-card/90 border border-border rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 hover:bg-accent"
      >
        <ChevronLeft className="h-4 w-4 text-foreground" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {books.map((book) => (
          <Link key={book.id} href={`/book/${book.id}`}>
            <div className="flex-shrink-0 w-32 cursor-pointer group/card">
              <div className="relative w-32 h-48 rounded-lg overflow-hidden shadow-md border border-border/50 mb-2 transition-transform group-hover/card:scale-105 duration-200">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-secondary flex flex-col items-center justify-center gap-2 p-3">
                    <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                    <span className="text-xs text-center text-muted-foreground line-clamp-3 font-serif">{book.title}</span>
                  </div>
                )}
                {book.averageRating > 0 && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {book.averageRating.toFixed(1)}
                  </div>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">{book.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{book.author}</p>
            </div>
          </Link>
        ))}
      </div>
      <button
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-card/90 border border-border rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 hover:bg-accent"
      >
        <ChevronRight className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}

// ── Seção Escolha da Semana ──────────────────────────────────────────────
function WeeklyPickSection() {
  const { data: pick, isLoading } = trpc.weeklyPick.get.useQuery(undefined, { staleTime: 1000 * 60 * 30 });
  const getWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((now.getTime() - start.getTime()) / 604800000) + 1;
  };
  if (isLoading) return <Skeleton className="h-36 rounded-xl" />;
  if (!pick) return null;
  const book = (pick as any).book ?? pick;
  const mentionCount = (pick as any).mentionCount ?? 0;
  return (
    <Link href={`/book/${book.id}`}>
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-accent/20 p-4 cursor-pointer hover:border-primary/50 transition-all group">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Escolha da Semana {getWeekNumber()}</span>
        </div>
        <div className="flex gap-4 items-start">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="w-16 h-24 rounded-md object-cover shadow-md flex-shrink-0 group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-16 h-24 bg-secondary rounded-md flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-lg text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">{book.title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{book.author}</p>
            {book.genre && <Badge variant="secondary" className="mt-1.5 text-xs">{book.genre}</Badge>}
            {mentionCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {mentionCount} menções esta semana
              </p>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  );
}

// ── Livros mais mencionados ──────────────────────────────────────────────
function MostMentionedSection() {
  const { data: mentioned, isLoading } = trpc.trending.mostMentionedBooks.useQuery({ limit: 6 }, { staleTime: 1000 * 60 * 10 });
  if (isLoading) return (
    <div className="grid grid-cols-3 gap-2">
      {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
    </div>
  );
  if (!mentioned?.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {mentioned.map(({ book, mentionCount }) => (
        <Link key={book.id} href={`/book/${book.id}`}>
          <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-accent/30 transition-all cursor-pointer">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-8 h-12 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-12 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-3 w-3 text-muted-foreground/50" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">{book.title}</p>
              <p className="text-xs text-primary font-medium mt-0.5">{mentionCount}×</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Painel lateral direito ───────────────────────────────────────────────
function RightSidebar() {
  const { data: trendingBooks, isLoading: loadingBooks } = trpc.books.list.useQuery({ limit: 8, offset: 0 }, { staleTime: 1000 * 60 * 5 });
  const { data: mentioned } = trpc.trending.mostMentionedBooks.useQuery({ limit: 5 }, { staleTime: 1000 * 60 * 10 });
  return (
    <aside className="hidden xl:block w-72 shrink-0 py-6 pr-4 space-y-6">
      {/* Livros em destaque */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground font-serif">Livros em Destaque</span>
          </div>
          <Link href="/feed">
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-primary px-2">
              Ver todos
            </Button>
          </Link>
        </div>
        {loadingBooks ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : (
          <div className="space-y-2">
            {(trendingBooks ?? []).slice(0, 5).map(book => (
              <Link key={book.id} href={`/book/${book.id}`}>
                <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer group">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-9 h-13 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-13 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{book.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
                    {book.averageRating > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-muted-foreground">{book.averageRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Mais mencionados */}
      {mentioned && mentioned.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-foreground font-serif">Mais Mencionados</span>
          </div>
          <div className="space-y-1.5">
            {mentioned.map(({ book, mentionCount }, i) => (
              <Link key={book.id} href={`/book/${book.id}`}>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer">
                  <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">#{i+1}</span>
                  <span className="text-xs text-foreground line-clamp-1 flex-1">{book.title}</span>
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 shrink-0">{mentionCount}×</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Link para livros */}
      <Link href="/feed">
        <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
          <BookMarked className="h-3.5 w-3.5" />
          Explorar Biblioteca
        </Button>
      </Link>
    </aside>
  );
}

// ── Página principal ─────────────────────────────────────────────────────
export default function Home() {
  const [sort, setSort] = useState<SortOption>("hot");
  const [offset, setOffset] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: trendingBooks, isLoading: loadingTrending } = trpc.books.list.useQuery(
    { limit: 12, offset: 0 },
    { staleTime: 1000 * 60 * 5 }
  );

  const currentQuery = trpc.posts.list.useQuery(
    { sort, limit: PAGE_SIZE, offset },
    { staleTime: 30000 }
  );

  useEffect(() => {
    if (currentQuery.data) {
      if (offset === 0) {
        setAllPosts(currentQuery.data);
      } else {
        setAllPosts((prev) => {
          const merged = [...prev];
          for (const post of currentQuery.data!) {
            if (!merged.find((p) => p.id === post.id)) merged.push(post);
          }
          return merged;
        });
      }
      setHasMore(currentQuery.data.length >= PAGE_SIZE);
      setLoadingMore(false);
    }
  }, [currentQuery.data, offset]);

  useEffect(() => {
    setOffset(0);
    setAllPosts([]);
    setHasMore(true);
    setLoadingMore(false);
  }, [sort]);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !currentQuery.isLoading) {
      setLoadingMore(true);
      setOffset((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore, loadingMore, currentQuery.isLoading]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting && hasMore && !loadingMore) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loadingMore]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "hot", label: "Populares" },
    { value: "new", label: "Novos" },
    { value: "top", label: "Top" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <MobileCommunities />
      <div className="flex-1 flex">
        <CommunitiesSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

            {/* ── Carrossel de livros trending ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground font-serif">Livros em Destaque</h2>
                </div>
                <Link href="/weekly">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-primary gap-1">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {loadingTrending ? (
                <div className="flex gap-4">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="w-32 h-56 rounded-lg flex-shrink-0" />)}
                </div>
              ) : (
                <BookCarousel books={(trendingBooks ?? []) as any} />
              )}
            </section>

            {/* ── Escolha da Semana ── */}
            <section>
              <WeeklyPickSection />
            </section>

            {/* ── Recomendado para você ── */}
            <section>
              <RecommendedSection />
            </section>

            {/* ── Livros mais mencionados ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-4 w-4 text-orange-500" />
                <h2 className="text-base font-semibold text-foreground font-serif">Mais Mencionados</h2>
              </div>
              <MostMentionedSection />
            </section>

            {/* ── Feed de posts ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground font-serif">Feed da Comunidade</h2>
                </div>
                <CreatePostDialog />
              </div>

              {/* Sort tabs */}
              <div className="flex gap-1 mb-4">
                {sortOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={sort === option.value ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSort(option.value)}
                    className="text-sm"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {currentQuery.isLoading && allPosts.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
              ) : allPosts.length > 0 ? (
                <div className="space-y-3">
                  {allPosts.map((post) => <PostCard key={post.id} post={post as any} />)}
                  <div ref={sentinelRef} className="py-4 flex justify-center">
                    {loadingMore || (hasMore && currentQuery.isLoading) ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : hasMore ? (
                      <Button variant="outline" size="sm" onClick={() => { if (!loadingMore) loadMore(); }}>
                        Carregar mais
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">Fim do feed</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-lg mb-2">Nenhum post ainda</p>
                  <p className="text-muted-foreground text-sm mb-4">Seja o primeiro a compartilhar algo!</p>
                  <CreatePostDialog />
                </div>
              )}
            </section>
          </div>
        </main>
        <RightSidebar />
      </div>
    </div>
  );
}
