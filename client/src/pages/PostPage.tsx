import { useParams, Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CommentThread from "@/components/CommentThread";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import {
  ArrowBigUp,
  ArrowBigDown,
  ArrowLeft,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const postId = parseInt(id ?? "0");
  const { isAuthenticated } = useAuth();
  const [commentContent, setCommentContent] = useState("");

  const { data: post, isLoading } = trpc.posts.getById.useQuery(
    { id: postId },
    { enabled: !!postId }
  );

  const utils = trpc.useUtils();

  const { data: userVote } = trpc.votes.getUserVote.useQuery(
    { targetType: "post", targetId: postId },
    { enabled: !!isAuthenticated && !!postId }
  );

  const castVote = trpc.votes.cast.useMutation({
    onSettled: () => {
      utils.posts.getById.invalidate({ id: postId });
    },
  });

  const createComment = trpc.comments.create.useMutation({
    onSuccess: () => {
      toast.success("Comentário enviado!");
      setCommentContent("");
      utils.comments.listByPost.invalidate({ postId });
      utils.posts.getById.invalidate({ id: postId });
    },
    onError: (error) => {
      toast.error("Erro ao comentar", { description: error.message });
    },
  });

  const handleVote = (value: "up" | "down") => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    castVote.mutate({ targetType: "post", targetId: postId, value });
  };

  const handleComment = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!commentContent.trim()) return;
    createComment.mutate({ postId, content: commentContent.trim() });
  };

  const voteCount = post ? post.upvotes - post.downvotes : 0;

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Post não encontrado</h1>
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
      <main className="flex-1 max-w-2xl mx-auto px-4 py-6">
        {/* Back button */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Feed
        </Link>

        {/* Post */}
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <div className="flex">
            {/* Vote column */}
            <div className="flex flex-col items-center gap-0.5 mr-4 w-10 shrink-0">
              <button
                onClick={() => handleVote("up")}
                className={`p-0.5 rounded hover:bg-accent transition-colors ${
                  userVote?.value === "up" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <ArrowBigUp className="h-6 w-6" />
              </button>
              <span
                className={`text-base font-bold tabular-nums ${
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
                <ArrowBigDown className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
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
              <h1 className="text-xl font-bold text-foreground mb-3">
                {post.title}
              </h1>

              {/* Content */}
              {post.content && (
                <div className="text-sm text-foreground whitespace-pre-wrap mb-4">
                  {post.content}
                </div>
              )}

              {/* Link */}
              {post.type === "link" && post.linkUrl && (
                <a
                  href={post.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {post.linkUrl}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Comment form */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            <MessageSquare className="inline h-4 w-4 mr-1" />
            Comentários
          </h3>
          <Textarea
            placeholder={isAuthenticated ? "Escreva um comentário..." : "Faça login para comentar"}
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            rows={3}
            className="resize-none mb-2"
            disabled={!isAuthenticated}
          />
          <Button
            size="sm"
            onClick={handleComment}
            disabled={createComment.isPending || !commentContent.trim()}
          >
            {createComment.isPending ? "Enviando..." : "Comentar"}
          </Button>
        </div>

        {/* Comment thread */}
        <CommentThread postId={postId} />
      </main>
    </div>
  );
}
