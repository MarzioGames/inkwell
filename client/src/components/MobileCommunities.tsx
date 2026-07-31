import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  Heart,
  Rocket,
  Shield,
  Flag,
  Store,
  Bookmark,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";

const communityIcons: Record<string, React.ReactNode> = {
  "desenvolvimento-pessoal": <BookOpen className="h-4 w-4" />,
  "romance": <Heart className="h-4 w-4" />,
  "ficcao-cientifica": <Rocket className="h-4 w-4" />,
  "thrillers": <Shield className="h-4 w-4" />,
  "literatura-brasileira": <Flag className="h-4 w-4" />,
};

export default function MobileCommunities() {
  const { data: communities, isLoading } = trpc.communities.list.useQuery();
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: useAuth().isAuthenticated,
    refetchInterval: 30000,
  });
  const { isAuthenticated } = useAuth();
  const { data: profile } = trpc.profile.get.useQuery(
    { userId: useAuth().user?.id || 0 },
    { enabled: !!useAuth().user?.id }
  );
  const [location] = useLocation();

  if (isLoading || !communities) return null;

  return (
    <div className="lg:hidden sticky top-14 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-1 p-2">
          {communities.map((community) => (
            <Link key={community.slug} href={`/community/${community.slug}`}>
              <Button
                variant="ghost"
                size="sm"
                className={`shrink-0 gap-1.5 text-xs px-3 h-8 ${
                  location === `/community/${community.slug}`
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-primary">{communityIcons[community.slug] || <BookOpen className="h-3.5 w-3.5" />}</span>
                <span className="truncate max-w-[120px]">{community.name}</span>
              </Button>
            </Link>
          ))}
          <Link href="/marketplace">
            <Button
              variant="ghost"
              size="sm"
              className={`shrink-0 gap-1.5 text-xs px-3 h-8 ${
                location === "/marketplace"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Store className="h-3.5 w-3.5" />
              Marketplace
            </Button>
          </Link>
          {isAuthenticated && (
            <Link href="/notifications">
              <Button
                variant="ghost"
                size="sm"
                className={`shrink-0 gap-1.5 text-xs px-3 h-8 relative ${
                  location === "/notifications"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Bell className="h-3.5 w-3.5" />
                Notificações
                {unreadData && unreadData.count > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                    {unreadData.count}
                  </span>
                )}
              </Button>
            </Link>
          )}
          <Link href="/favorites">
            <Button
              variant="ghost"
              size="sm"
              className={`shrink-0 gap-1.5 text-xs px-3 h-8 ${
                location === "/favorites"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Favoritos
            </Button>
          </Link>
        </div>
      </ScrollArea>
    </div>
  );
}
