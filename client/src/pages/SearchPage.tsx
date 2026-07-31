import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Flame, Heart, Users } from "lucide-react";
import PostCard from "@/components/PostCard";

export default function SearchPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("q") || "";

  const results = trpc.search.global.useQuery(
    { query },
    {
      enabled: query.length >= 1,
    }
  );

  if (!query) {
    return (
      <div className="container py-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Pesquisar</h1>
        <p className="text-muted-foreground">Digite algo na barra de pesquisa para começar.</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">
        Resultados para &ldquo;{query}&rdquo;
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {results.isLoading
          ? "Buscando..."
          : `${
              (results.data?.posts?.length || 0) +
              (results.data?.listings?.length || 0) +
              (results.data?.communities?.length || 0)
            } resultados encontrados`}
      </p>

      {results.isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-secondary/30 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!results.isLoading && results.data && (
        <div className="space-y-8">
          {/* Communities */}
          {results.data.communities.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Comunidades
              </h2>
              <div className="space-y-2">
                {results.data.communities.map((c) => (
                  <Link key={c.id} href={`/community/${c.slug}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.memberCount} membros
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Posts */}
          {results.data.posts.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                Posts
              </h2>
              <div className="space-y-3">
                {results.data.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}

          {/* Listings */}
          {results.data.listings.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Marketplace
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.data.listings.map((listing) => (
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
            </section>
          )}

          {/* No results */}
          {results.data.posts.length === 0 &&
            results.data.listings.length === 0 &&
            results.data.communities.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-foreground mb-1">Nenhum resultado encontrado</p>
                <p className="text-muted-foreground text-sm">
                  Tente buscar com termos diferentes
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
