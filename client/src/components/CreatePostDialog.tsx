import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, BookOpen, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function CreatePostDialog({
  trigger = "button",
  communitySlug,
}: {
  trigger?: "button" | "icon";
  communitySlug?: string;
}) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [postType, setPostType] = useState<"text" | "link">("text");
  const [selectedCommunity, setSelectedCommunity] = useState(communitySlug ?? "");

  const utils = trpc.useUtils();
  const [detectedBooks, setDetectedBooks] = useState<{ title: string; author?: string | null }[]>([]);
  const [detecting, setDetecting] = useState(false);
  const detectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: communities } = trpc.communities.list.useQuery();
  const detectMentions = trpc.ai.detectBookMentions.useMutation();
  const recordMentions = trpc.ai.recordMentions.useMutation();

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    if (detectTimeout.current) clearTimeout(detectTimeout.current);
    if (text.trim().length < 20) { setDetectedBooks([]); return; }
    detectTimeout.current = setTimeout(async () => {
      setDetecting(true);
      try {
        const result = await detectMentions.mutateAsync({ text });
        setDetectedBooks(result.books ?? []);
      } catch { /* silently ignore */ }
      finally { setDetecting(false); }
    }, 1500);
  }, [detectMentions]);

  const createPost = trpc.posts.create.useMutation({
    onSuccess: (data) => {
      toast.success("Post criado com sucesso!");
      setOpen(false);
      setTitle("");
      setContent("");
      setLinkUrl("");
      setDetectedBooks([]);
      utils.posts.list.invalidate();
      if (data.id) {
        utils.posts.getById.invalidate({ id: data.id });
        if (detectedBooks.length > 0) {
          recordMentions.mutate({ bookTitles: detectedBooks.map(b => b.title), postId: data.id });
        }
      }
    },
    onError: (error) => {
      toast.error("Erro ao criar post", { description: error.message });
    },
  });

  const handleSubmit = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (!selectedCommunity) {
      toast.error("Selecione uma comunidade");
      return;
    }
    createPost.mutate({
      communitySlug: selectedCommunity,
      title: title.trim(),
      content: postType === "text" ? content.trim() : (undefined as undefined),
      linkUrl: postType === "link" ? linkUrl.trim() : (undefined as undefined),
      type: postType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "icon" ? (
          <Button size="icon" variant="ghost" className="h-9 w-9">
            <Plus className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5">
            <Pencil className="h-4 w-4" />
            Criar Post
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Criar Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Community */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Comunidade
            </label>
            <Select value={selectedCommunity} onValueChange={setSelectedCommunity} disabled={!!communitySlug}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="Selecione uma comunidade" />
              </SelectTrigger>
              <SelectContent>
                {communities?.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="flex gap-2">
            <Button
              variant={postType === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => setPostType("text")}
              className="flex-1"
            >
              Texto
            </Button>
            <Button
              variant={postType === "link" ? "default" : "outline"}
              size="sm"
              onClick={() => setPostType("link")}
              className="flex-1"
            >
              Link
            </Button>
          </div>

          {/* Title */}
          <Input
            placeholder="Título do post"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={512}
          />

          {/* Content or Link */}
          {postType === "text" ? (
            <Textarea
              placeholder="Conteúdo do post..."
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              rows={6}
              className="resize-none"
            />
          ) : (
            <Input
              placeholder="https://exemplo.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              type="url"
            />
          )}

          <Button
            onClick={handleSubmit}
            disabled={createPost.isPending || !title.trim()}
            className="w-full"
          >
            {createPost.isPending ? "Publicando..." : "Publicar"}
          </Button>

          {/* Menções de livros detectadas */}
          {(detectedBooks.length > 0 || detecting) && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">Livros detectados no post</span>
                {detecting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
              </div>
              {detectedBooks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detectedBooks.map((book, i) => (
                    <Badge key={i} variant="outline" className="text-xs gap-1 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 cursor-pointer">
                      <BookOpen className="h-2.5 w-2.5" />
                      {book.title}
                      {book.author && <span className="text-muted-foreground">· {book.author}</span>}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">Esses livros serão registrados como menções ao publicar.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
