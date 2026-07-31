import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowBigUp, ArrowBigDown, MessageSquare, ExternalLink } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import FavoriteButton from "@/components/FavoriteButton";
import ReportButton from "@/components/ReportButton";

interface PostData {
  id: number;
  title: string;
  content: string | null;
  linkUrl: string | null;
  type: "text" | "link";
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: Date;
  communityName: string;
  communitySlug: string;
  authorName: string;
  authorId: number;
}

export default function PostCard({ post }: { post: PostData }) {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const voteCount = post.upvotes - post.downvotes;

  const { data: userVote } = trpc.votes.getUserVote.useQuery(
    { targetType: "post", targetId: post.id },
    { enabled: !!isAuthenticated }
  );

  const castVote = trpc.votes.cast.useMutation({
    onMutate: async ({ value }) => {
      await utils.posts.list.cancel();
      const previous = utils.posts.list.getData({});
      utils.posts.list.setData({}, (old) => {
        if (!old) return old;
        return old.map((p) =>
          p.id === post.id
            ? {
                ...p,
                upvotes: value === "up" ? p.upvotes + 1 : p.upvotes,
                downvotes: value === "down" ? p.downvotes + 1 : p.downvotes,
              }
            : p
        );
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      utils.posts.list.setData({}, context?.previous);
      toast.error("Erro ao votar");
    },
    onSettled: () => {
      utils.posts.list.invalidate();
    },
  });

  const handleVote = (value: "up" | "down") => {
    if (!isAuthenticated) {
      toast("Faça login para votar", { description: "Entre para participar da comunidade" });
      startLogin();
      return;
    }
    castVote.mutate({ targetType: "post", targetId: post.id, value });
  };

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

  return (
    <div className="rounded-xl border border-border bg-card hover:border-border/80 transition-colors group">
      <div className="flex">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-0.5 py-3 pl-3 w-10 shrink-0">
          <button
            onClick={() => handleVote("up")}
            className={`p-0.5 rounded hover:bg-accent transition-colors ${
              userVote?.value === "up" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ArrowBigUp className="h-5 w-5" />
          </button>
          <span
            className={`text-sm font-semibold tabular-nums ${
              voteCount > 0 ? "text-primary" : voteCount < 0 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {voteCount}
          </span>
          <button
            onClick={() => handleVote("down")}
            className={`p-0.5 rounded hover:bg-accent transition-colors ${
              userVote?.value === "down" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            <ArrowBigDown className="h-5 w-5" />
          </button>
        </div>

        {/* Content column */}
        <div className="flex-1 py-3 pr-4 min-w-0">
          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <Link
              href={`/community/${post.communitySlug}`}
              className="hover:text-primary font-medium transition-colors"
            >
              {post.communityName}
            </Link>
            <span>•</span>
            <span>por {post.authorName}</span>
            <span>•</span>
            <span>{timeAgo(post.createdAt)}</span>
          </div>

          {/* Title */}
          <Link href={`/post/${post.id}`}>
            <h3 className="text-base font-semibold leading-snug text-foreground hover:text-primary transition-colors mb-1.5 line-clamp-2">
              {post.title}
            </h3>
          </Link>

          {/* Content preview */}
          {post.content && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
              {post.content}
            </p>
          )}

          {/* Link */}
          {post.type === "link" && post.linkUrl && (
            <a
              href={post.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2"
            >
              <ExternalLink className="h-3 w-3" />
              {new URL(post.linkUrl).hostname}
            </a>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Link href={`/post/${post.id}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                {post.commentCount} comentários
              </Button>
            </Link>
            <FavoriteButton targetType="post" targetId={post.id} />
            <ReportButton targetType="post" targetId={post.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
