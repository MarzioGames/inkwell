import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CommunitiesSidebar from "@/components/CommunitiesSidebar";
import MobileCommunities from "@/components/MobileCommunities";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, BookOpen, ArrowRight, TrendingUp, Users } from "lucide-react";

export default function WeeklyPickPage() {
  const { data: topPosts, isLoading } = trpc.posts.list.useQuery(
    { sort: "top", communitySlug: undefined, limit: 5, offset: 0 },
    { staleTime: 1000 * 60 * 10 }
  );

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "agora";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 604800000;
    return Math.ceil(diff / oneWeek) + 1;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <MobileCommunities />
      <div className="flex-1 flex">
        <CommunitiesSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium">Seleção da Semana {getWeekNumber()}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Livros em Destaque</h1>
              <p className="text-sm text-muted-foreground mt-1">
                As discussões mais populares desta semana na comunidade Inkwell
              </p>
            </div>

            {/* Weekly Picks - Top Posts */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : topPosts && topPosts.length > 0 ? (
              <div className="space-y-3">
                {topPosts.map((post, index) => (
                  <Link key={post.id} href={`/post/${post.id}`}>
                    <div className="rounded-xl border border-border bg-card hover:border-primary/30 transition-all p-4 cursor-pointer group">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <span className="text-sm font-bold text-primary">#{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {post.communityName}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {timeAgo(post.createdAt)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                            {post.title}
                          </h3>
                          {post.content && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {post.content}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Destaque #{index + 1}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {post.commentCount} comentários
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground text-lg mb-2">Ainda não há posts esta semana</p>
                <p className="text-muted-foreground text-sm">Participe das discussões e seja o primeiro!</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
