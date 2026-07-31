import { useParams, Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import {
  Star,
  BookOpen,
  Users,
  MessageSquare,
  Plus,
  Check,
  ArrowLeft,
  Share2,
  Heart,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id ?? "0");
  const { isAuthenticated, user } = useAuth();
  const [reviewContent, setReviewContent] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [readingStatus, setReadingStatus] = useState<'read' | 'reading' | 'want_to_read'>('want_to_read');

  const { data: book, isLoading: bookLoading } = trpc.books.getById.useQuery(
    { id: bookId },
    { enabled: !!bookId }
  );

  const { data: reviews } = trpc.bookReviews.list.useQuery(
    { bookId, limit: 10 },
    { enabled: !!bookId }
  );

  const { data: readingList } = trpc.readingList.get.useQuery(
    { status: undefined },
    { enabled: isAuthenticated }
  );

  const { data: recommendations } = trpc.recommendations.get.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const utils = trpc.useUtils();

  const addToReadingList = trpc.readingList.add.useMutation({
    onSuccess: () => {
      toast.success("Livro adicionado à sua biblioteca!");
      utils.readingList.get.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao adicionar livro", { description: error.message });
    },
  });

  const createReview = trpc.bookReviews.create.useMutation({
    onSuccess: () => {
      toast.success("Resenha publicada!");
      setReviewContent("");
      setReviewRating(5);
      utils.bookReviews.list.invalidate({ bookId });
    },
    onError: (error) => {
      toast.error("Erro ao publicar resenha", { description: error.message });
    },
  });

  const handleAddToList = (status: 'read' | 'reading' | 'want_to_read') => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    addToReadingList.mutate({ bookId, status });
  };

  const handleSubmitReview = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!reviewContent.trim()) {
      toast.error("Escreva uma resenha");
      return;
    }
    createReview.mutate({
      bookId,
      rating: reviewRating,
      content: reviewContent,
    });
  };

  const isInReadingList = readingList?.some(item => item.bookId === bookId);

  if (bookLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </main>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h1 className="text-2xl font-bold text-foreground">Livro não encontrado</h1>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header com botão voltar */}
          <Link href="/feed">
            <Button variant="ghost" size="sm" className="mb-6 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>

          {/* Hero Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Capa do livro */}
            <div className="flex justify-center">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="h-80 w-auto rounded-lg shadow-lg object-cover"
                />
              ) : (
                <div className="h-80 w-56 bg-secondary rounded-lg flex items-center justify-center">
                  <BookOpen className="h-16 w-16 text-muted-foreground opacity-50" />
                </div>
              )}
            </div>

            {/* Informações do livro */}
            <div className="md:col-span-2">
              <div className="mb-4">
                {book.genre && (
                  <Badge variant="secondary" className="mb-2">
                    {book.genre}
                  </Badge>
                )}
              </div>

              <h1 className="text-4xl font-bold text-foreground mb-2">{book.title}</h1>
              <p className="text-xl text-muted-foreground mb-4">por {book.author}</p>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(book.averageRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-semibold text-foreground">
                  {book.averageRating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({book.ratingCount} avaliações)
                </span>
              </div>

              {/* Metadados */}
              <div className="space-y-2 mb-6 text-sm text-muted-foreground">
                {book.publisher && <p><strong>Editora:</strong> {book.publisher}</p>}
                {book.publishedYear && <p><strong>Publicado:</strong> {book.publishedYear}</p>}
                {book.pageCount && <p><strong>Páginas:</strong> {book.pageCount}</p>}
                {book.isbn && <p><strong>ISBN:</strong> {book.isbn}</p>}
              </div>

              {/* Botões de ação */}
              <div className="flex flex-wrap gap-3 mb-6">
                <Button
                  onClick={() => handleAddToList('want_to_read')}
                  variant={isInReadingList ? "secondary" : "default"}
                  className="gap-2"
                >
                  {isInReadingList ? (
                    <>
                      <Check className="h-4 w-4" />
                      Na sua biblioteca
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Adicionar à biblioteca
                    </>
                  )}
                </Button>
                <Button variant="outline" className="gap-2">
                  <Heart className="h-4 w-4" />
                  Favoritar
                </Button>
                <Button variant="outline" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Comprar
                </Button>
                <Button variant="outline" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Sinopse */}
          {book.description && (
            <div className="mb-12 p-6 bg-secondary/50 rounded-lg">
              <h2 className="text-xl font-bold text-foreground mb-3">Sinopse</h2>
              <p className="text-muted-foreground leading-relaxed">{book.description}</p>
            </div>
          )}

          {/* Tabs: Resenhas, Discussões, Recomendações */}
          <Tabs defaultValue="reviews" className="mb-12">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="reviews" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Resenhas
              </TabsTrigger>
              <TabsTrigger value="discussions" className="gap-2">
                <Users className="h-4 w-4" />
                Discussões
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Semelhantes
              </TabsTrigger>
            </TabsList>

            {/* Resenhas */}
            <TabsContent value="reviews" className="space-y-6">
              {isAuthenticated && (
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Escrever uma resenha</h3>
                  <div className="mb-3">
                    <label className="text-sm text-muted-foreground mb-2 block">Nota</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setReviewRating(star)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-6 w-6 ${
                              star <= reviewRating
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    placeholder="Compartilhe sua opinião sobre este livro..."
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    className="mb-3"
                  />
                  <Button
                    onClick={handleSubmitReview}
                    disabled={createReview.isPending}
                    className="w-full"
                  >
                    Publicar resenha
                  </Button>
                </div>
              )}

              {/* Lista de resenhas */}
              <div className="space-y-4">
                {reviews && reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < review.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-semibold text-foreground">{review.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          👍 {review.upvotes}
                        </div>
                      </div>
                      {review.content && (
                        <p className="text-sm text-muted-foreground">{review.content}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma resenha ainda. Seja o primeiro a avaliar!
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Discussões */}
            <TabsContent value="discussions">
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">Discussões sobre este livro em breve</p>
              </div>
            </TabsContent>

            {/* Recomendações */}
            <TabsContent value="recommendations">
              {recommendations && recommendations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.slice(0, 4).map((rec) => (
                    <Link key={rec.book.id} href={`/book/${rec.book.id}`}>
                      <div className="p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                        <div className="flex gap-3">
                          {rec.book.coverUrl && (
                            <img
                              src={rec.book.coverUrl}
                              alt={rec.book.title}
                              className="h-20 w-16 rounded object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground truncate">
                              {rec.book.title}
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {rec.book.author}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              <span className="text-xs font-semibold">
                                {rec.book.averageRating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">
                    Recomendações personalizadas em breve
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
