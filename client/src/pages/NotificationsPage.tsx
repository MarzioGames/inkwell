import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CommunitiesSidebar from "@/components/CommunitiesSidebar";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { startLogin } from "@/const";
import { toast } from "sonner";
import {
  MessageSquare,
  TrendingUp,
  Reply,
  ShoppingCart,
  UserPlus,
  Check,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, React.ReactNode> = {
  chat_message: <MessageSquare className="h-4 w-4" />,
  post_upvote: <TrendingUp className="h-4 w-4" />,
  comment_reply: <Reply className="h-4 w-4" />,
  listing_sold: <ShoppingCart className="h-4 w-4" />,
  new_follower: <UserPlus className="h-4 w-4" />,
};

const colorMap: Record<string, string> = {
  chat_message: "bg-blue-500/10 text-blue-400",
  post_upvote: "bg-green-500/10 text-green-400",
  comment_reply: "bg-purple-500/10 text-purple-400",
  listing_sold: "bg-amber-500/10 text-amber-400",
  new_follower: "bg-pink-500/10 text-pink-400",
};

export default function NotificationsPage() {
  const { isAuthenticated, user } = useAuth();
  const [location, navigate] = useLocation();

  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("Todas as notificações marcadas como lidas");
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const utils = trpc.useUtils();

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Faça login para ver notificações</h1>
            <Button onClick={startLogin}>Entrar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex">
        <CommunitiesSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Fique por dentro do que acontece na comunidade
                </p>
              </div>
              {notifications && notifications.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} className="gap-1">
                  <Check className="h-3 w-3" />
                  Marcar todas como lidas
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />
                ))}
              </div>
            ) : notifications && notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      !notif.isRead
                        ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                        : "border-border bg-card hover:bg-secondary/50"
                    }`}
                    onClick={() => {
                      if (!notif.isRead) markRead.mutate({ id: notif.id });
                      if (notif.link) navigate(notif.link);
                    }}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${colorMap[notif.type] || "bg-secondary text-muted-foreground"}`}>
                      {iconMap[notif.type] || <BookOpen className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{notif.title}</p>
                      {notif.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.isRead && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground text-lg mb-2">Nenhuma notificação</p>
                <p className="text-muted-foreground text-sm">Você será notificado sobre atividades na comunidade</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
