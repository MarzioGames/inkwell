import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Bookmark, Heart, Flame, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PostCard from "@/components/PostCard";
import LandingRedirect from "@/components/LandingRedirect";

export default function FavoritesPage() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // Hooks MUST be called unconditionally - placed before any conditional returns
  const postFavorites = trpc.favorites.getPostFavorites.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const listingFavorites = trpc.favorites.getListingFavorites.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <LandingRedirect />;
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
        <Bookmark className="h-6 w-6 text-primary" />
        Meus Favoritos
      </h1>
      <p className="text-muted-foreground mb-6">
        Posts e livros que você salvou para acessar depois
      </p>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Posts ({postFavorites.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="listings" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Marketplace ({listingFavorites.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          {postFavorites.isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-secondary/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : postFavorites.data && postFavorites.data.length > 0 ? (
            <div className="space-y-3">
              {postFavorites.data.map((post: any) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-foreground mb-1">Nenhum post favorito</p>
              <p className="text-muted-foreground text-sm">
                Salve posts interessantes para acessá-los rapidamente depois
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="listings">
          {listingFavorites.isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-secondary/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : listingFavorites.data && listingFavorites.data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {listingFavorites.data.map((listing: any) => (
                <Link key={listing.id} href={`/listing/${listing.id}`}>
                  <div className="flex gap-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer bg-card">
                    {listing.imageUrl ? (
                      <img
                        src={listing.imageUrl}
                        alt={listing.bookTitle}
                        className="w-20 h-28 object-cover rounded-md shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-28 bg-secondary/50 rounded-md flex items-center justify-center shrink-0">
                        <Heart className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{listing.bookTitle}</p>
                      <p className="text-sm text-muted-foreground truncate">{listing.author}</p>
                      <p className="text-primary font-bold mt-1">R$ {listing.price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {listing.condition === "like_new"
                          ? "Como novo"
                          : listing.condition === "new"
                          ? "Novo"
                          : listing.condition === "good"
                          ? "Bom"
                          : listing.condition === "fair"
                          ? "Regular"
                          : "Usado"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-foreground mb-1">Nenhum livro salvo</p>
              <p className="text-muted-foreground text-sm">
                Explore o marketplace e salve livros que te interessem
              </p>
              <Link href="/marketplace">
                <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Explorar Marketplace
                </button>
              </Link>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
