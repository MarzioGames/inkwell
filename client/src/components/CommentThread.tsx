import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import { ArrowBigUp, ArrowBigDown, MessageSquare, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentData {
  id: number;
  postId: number;
  authorId: number;
  parentId: number | null;
  content: string;
  upvotes: number;
  downvotes: number;
  depth: number;
  createdAt: Date;
  authorName: string;
}

interface CommentNode {
  comment: CommentData;
  replies: CommentNode[];
}

function buildTree(comments: CommentData[]): CommentNode[] {
  const map = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((c) => {
    map.set(c.id, { comment: c, replies: [] });
  });

  comments.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function CommentItem({
  node,
  postId,
  depth = 0,
}: {
  node: CommentNode;
  postId: number;
  depth?: number;
}) {
  const { user, isAuthenticated } = useAuth();
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const utils = trpc.useUtils();
  const voteCount = node.comment.upvotes - node.comment.downvotes;

  const { data: userVote } = trpc.votes.getUserVote.useQuery(
    { targetType: "comment", targetId: node.comment.id },
    { enabled: !!isAuthenticated }
  );

  const castVote = trpc.votes.cast.useMutation({
    onSettled: () => {
      utils.comments.listByPost.invalidate({ postId });
    },
  });

  const createReply = trpc.comments.create.useMutation({
    onSuccess: () => {
      toast.success("Resposta enviada!");
      setReplyContent("");
      setShowReply(false);
      utils.comments.listByPost.invalidate({ postId });
    },
    onError: (error) => {
      toast.error("Erro ao responder", { description: error.message });
    },
  });

  const handleReply = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!replyContent.trim()) return;
    createReply.mutate({
      postId,
      content: replyContent.trim(),
      parentId: node.comment.id,
    });
  };

  const handleVote = (value: "up" | "down") => {
    if (!isAuthenticated) {
      toast("Faça login para votar", { description: "Entre para participar da comunidade" });
      startLogin();
      return;
    }
    castVote.mutate({ targetType: "comment", targetId: node.comment.id, value });
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

  if (collapsed) {
    return (
      <div className="ml-4 py-1">
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <CornerDownRight className="h-3 w-3" />
          {node.comment.authorName} • {node.replies.length + 1} respostas
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Depth indicator line */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-border rounded-full"
          style={{ left: "-12px" }}
        />
      )}

      <div className="py-2">
        {/* Comment header */}
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={() => setCollapsed(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {node.comment.authorName}
          </button>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(node.comment.createdAt)}
          </span>
        </div>

        {/* Comment content */}
        <p className="text-sm text-foreground mb-2 whitespace-pre-wrap break-words">
          {node.comment.content}
        </p>

        {/* Comment actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleVote("up")}
            className={`p-0.5 rounded hover:bg-accent transition-colors ${
              userVote?.value === "up" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ArrowBigUp className="h-4 w-4" />
          </button>
          <span
            className={`text-xs font-semibold tabular-nums min-w-[20px] text-center ${
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
            <ArrowBigDown className="h-4 w-4" />
          </button>

          {depth < 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowReply(!showReply)}
            >
              <MessageSquare className="h-3 w-3" />
              Responder
            </Button>
          )}
        </div>

        {/* Reply form */}
        {showReply && (
          <div className="mt-2 ml-2 space-y-2">
            <Textarea
              placeholder="Escreva sua resposta..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleReply}
                disabled={createReply.isPending || !replyContent.trim()}
              >
                {createReply.isPending ? "Enviando..." : "Enviar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowReply(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Replies */}
        {node.replies.length > 0 && (
          <div className="mt-1 ml-4 space-y-1">
            {node.replies.map((reply) => (
              <CommentItem
                key={reply.comment.id}
                node={reply}
                postId={postId}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentThread({
  postId,
}: {
  postId: number;
}) {
  const { data: comments, isLoading } = trpc.comments.listByPost.useQuery({
    postId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-secondary/30 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground text-sm">
          Nenhum comentário ainda. Seja o primeiro!
        </p>
      </div>
    );
  }

  const tree = buildTree(comments as CommentData[]);

  return (
    <div className="space-y-1">
      {tree.map((node) => (
        <CommentItem key={node.comment.id} node={node} postId={postId} />
      ))}
    </div>
  );
}
