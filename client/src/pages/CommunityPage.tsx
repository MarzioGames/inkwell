import { useParams } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CommunitiesSidebar from "@/components/CommunitiesSidebar";
import PostCard from "@/components/PostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import MobileCommunities from "@/components/MobileCommunities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Users, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type SortOption = "hot" | "new" | "top";

export default function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const [sort, setSort] = useState<SortOption>("hot");

  const { data: community, isLoading: communityLoading } = trpc.communities.getBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  const { data: posts, isLoading: postsLoading } = trpc.posts.list.useQuery({
    communitySlug: slug,
    sort,
  });

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "hot", label: "Populares" },
    { value: "new", label: "Novos" },
    { value: "top", label: "Top" },
  ];

  if (communityLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex">
          <CommunitiesSidebar />
          <main className="flex-1 px-4 py-6">
            <Skeleton className="h-40 rounded-xl" />
          </main>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Comunidade não encontrada</h1>
            <Link href="/">
              <Button variant="outline">Voltar ao Feed</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <MobileCommunities />
      <div className="flex-1 flex">
        <CommunitiesSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
            {/* Community header */}
            <div className="rounded-xl border border-border bg-card p-6">
              <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-3 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Feed
              </Link>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <BookOpen className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-foreground">{community.name}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {community.description}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {community.memberCount} membros
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Create post */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Posts</h2>
              <CreatePostDialog communitySlug={slug} />
            </div>

            {/* Sort */}
            <div className="flex gap-1">
              {sortOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={sort === option.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSort(option.value)}
                  className={`text-sm ${
                    sort === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {/* Posts */}
            {postsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="space-y-3">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post as any} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg mb-2">Nenhum post ainda</p>
                <p className="text-muted-foreground text-sm mb-4">
                  Seja o primeiro a postar nesta comunidade!
                </p>
                <CreatePostDialog communitySlug={slug} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
