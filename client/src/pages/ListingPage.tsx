import { useParams, Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  CreditCard,
  Tag,
  User,
  Bookmark,
  Star,
  Sparkles,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FavoriteButton from "@/components/FavoriteButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const conditionLabels: Record<string, string> = {
  new: "Novo",
  like_new: "Como Novo",
  good: "Bom",
  fair: "Regular",
  poor: "Usado",
};

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const listingId = parseInt(id ?? "0");
  const { user, isAuthenticated } = useAuth();
  const [message, setMessage] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const { data: listing, isLoading } = trpc.listings.getById.useQuery(
    { id: listingId },
    { enabled: !!listingId }
  );

  const { data: reviewsData } = trpc.reviews.getBySeller.useQuery(
    { sellerId: listing?.authorId ?? 0 },
    { enabled: !!listing?.authorId }
  );

  const { data: hasReviewed } = trpc.reviews.hasReviewed.useQuery(
    { listingId, reviewerId: user?.id ?? 0 },
    { enabled: !!listing && !!user && listing.authorId !== user?.id }
  );

  const utils = trpc.useUtils();

  const getOrCreateRoom = trpc.chat.getOrCreateRoom.useMutation({
    onSuccess: (room) => {
      toast.success("Chat iniciado!");
      window.location.href = `/messages?room=${room.id}`;
    },
    onError: (error) => toast.error(error.message),
  });

  const createCheckout = trpc.checkout.create.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.success("Redirecionando para pagamento...");
        window.open(data.checkoutUrl, '_blank');
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const createReview = trpc.reviews.create.useMutation({
    onSuccess: () => {
      toast.success("Avaliação enviada!");
      setReviewDialogOpen(false);
      setReviewComment("");
      utils.reviews.getBySeller.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const featureListing = trpc.featured.feature.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.success("Redirecionando para pagamento do destaque...");
        window.open(data.checkoutUrl, '_blank');
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const handleContact = () => {
    if (!isAuthenticated) { startLogin(); return; }
    getOrCreateRoom.mutate({ listingId });
  };

  const handleBuy = () => {
    if (!isAuthenticated) { startLogin(); return; }
    createCheckout.mutate({ listingId });
  };

  const handleSubmitReview = () => {
    if (!user) return;
    createReview.mutate({
      listingId,
      sellerId: listing!.authorId,
      rating: reviewRating,
      comment: reviewComment || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-64 rounded-xl mb-4" />
          <Skeleton className="h-6 w-1/2 mb-2" />
          <Skeleton className="h-24 w-full" />
        </main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Anúncio não encontrado</h1>
            <Link href="/marketplace"><Button variant="outline">Voltar ao Marketplace</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === listing.authorId;
  const canReview = isAuthenticated && !isOwner && (hasReviewed?.hasReviewed !== true);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-6">
        <Link href="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Marketplace
        </Link>

        {/* Image */}
        {listing.imageUrl ? (
          <div className="h-64 rounded-xl bg-secondary mb-4 overflow-hidden">
            <img src={listing.imageUrl} alt={listing.bookTitle} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-64 rounded-xl bg-secondary mb-4 flex items-center justify-center">
            <BookOpen className="h-16 w-16 text-muted-foreground opacity-50" />
          </div>
        )}

        {/* Info */}
        <div className="space-y-4">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{listing.bookTitle}</h1>
                <p className="text-muted-foreground mt-1">por {listing.author}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-3xl font-bold text-primary">R$ {listing.price.toFixed(2)}</span>
                <div className="mt-1">
                  <Badge variant="outline" className={`${listing.condition === "new" ? "bg-green-500/10 text-green-400 border-green-500/20" : listing.condition === "like_new" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                    {conditionLabels[listing.condition]}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{listing.description}</div>
          )}

          {/* Seller info with rating */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{listing.authorName}</p>
                {reviewsData && (reviewsData.count ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400" />
                    {(reviewsData.avg ?? 0).toFixed(1)} ({reviewsData.count})
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Vendedor</p>
            </div>
            {!isOwner && canReview && (
              <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <Star className="h-3 w-3" />
                    Avaliar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Avaliar Vendedor</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Nota</Label>
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => setReviewRating(n)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-6 w-6 ${n <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Comentário (opcional)</Label>
                      <Textarea
                        placeholder="Sua experiência com este vendedor..."
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleSubmitReview} disabled={createReview.isPending} className="w-full">
                      {createReview.isPending ? "Enviando..." : "Enviar Avaliação"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Reviews list */}
          {reviewsData && reviewsData.reviews.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Avaliações ({reviewsData.count ?? 0})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {reviewsData.reviews.map((review) => (
                  <div key={review.id} className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium">{review.reviewerName}</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-3 w-3 ${n <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    </div>
                    {review.comment && <p className="text-xs text-muted-foreground">{review.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isOwner && (
            <div className="flex gap-2">
              <Button onClick={handleContact} variant="outline" className="flex-1 gap-2" disabled={getOrCreateRoom.isPending}>
                <MessageSquare className="h-4 w-4" />
                {getOrCreateRoom.isPending ? "Iniciando..." : "Contatar Vendedor"}
              </Button>
              <Button onClick={handleBuy} className="flex-1 gap-2" disabled={createCheckout.isPending}>
                <CreditCard className="h-4 w-4" />
                {createCheckout.isPending ? "Processando..." : "Comprar Agora"}
              </Button>
            </div>
          )}

          {/* Favorite */}
          {!isOwner && (
            <div className="mt-3">
              <FavoriteButton targetType="listing" targetId={listingId} />
            </div>
          )}

          {/* Feature listing (owner only) */}
          {isOwner && listing.status === 'active' && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Destaque seu anúncio
                  </p>
                  <p className="text-xs text-muted-foreground">R$ 5/dia por até 30 dias</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => featureListing.mutate({ listingId, durationDays: 7 })}
                  disabled={featureListing.isPending}
                >
                  {featureListing.isPending ? "Processando..." : "Destacar"}
                </Button>
              </div>
            </div>
          )}

          {isOwner && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
              <p className="text-sm text-primary">Este é o seu anúncio</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
