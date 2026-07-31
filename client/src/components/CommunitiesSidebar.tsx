import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  Heart,
  Rocket,
  Shield,
  Flag,
  Plus,
  Store,
  Bookmark,
  Bell,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const communityIcons: Record<string, React.ReactNode> = {
  "desenvolvimento-pessoal": <BookOpen className="h-4 w-4" />,
  "romance": <Heart className="h-4 w-4" />,
  "ficcao-cientifica": <Rocket className="h-4 w-4" />,
  "thrillers": <Shield className="h-4 w-4" />,
  "literatura-brasileira": <Flag className="h-4 w-4" />,
};

function slugify(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function CommunitiesSidebar() {
  const { data: communities, isLoading } = trpc.communities.list.useQuery();
  const { user, isAuthenticated } = useAuth();
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, { enabled: isAuthenticated });
  const [location] = useLocation();

  // Create community dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const utils = trpc.useUtils();
  const createCommunity = trpc.createCommunity.create.useMutation({
    onSuccess: () => {
      toast.success('Comunidade criada com sucesso!');
      setCreateOpen(false);
      setName('');
      setDescription('');
      utils.communities.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao criar comunidade');
    },
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    const slug = slugify(name);
    createCommunity.mutate(
      { name: name.trim(), slug, description: description.trim() || undefined },
    );
  };

  // Join/Leave
  const joinMutation = trpc.communityMembers.join.useMutation();
  const leaveMutation = trpc.communityMembers.leave.useMutation();
  const memberCheck = trpc.communityMembers.isMember.useQuery(
    { communitySlug: '' },
    { enabled: false }
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <div className="h-4 bg-secondary rounded w-32 animate-pulse" />
        <div className="h-8 bg-secondary rounded animate-pulse" />
        <div className="h-8 bg-secondary rounded animate-pulse" />
        <div className="h-8 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  return (
    <aside className="w-64 shrink-0 hidden lg:block">
      <div className="sticky top-20 space-y-4">
        {/* Comunidades */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Comunidades
          </h3>
          <div className="space-y-1">
            {communities?.map((community) => (
              <Link key={community.slug} href={`/community/${community.slug}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-start gap-2 text-sm ${
                    location === `/community/${community.slug}`
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <span className="text-primary">{communityIcons[community.slug] || <BookOpen className="h-4 w-4" />}</span>
                  <span className="truncate">{community.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {community.memberCount || 0}
                  </span>
                </Button>
              </Link>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Criar comunidade
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => toast.info('Faça login para criar comunidades')}
              >
                <Plus className="h-4 w-4" />
                Criar comunidade
              </Button>
            )}
          </div>
        </div>

        {/* Marketplace */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <Link href="/marketplace">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start gap-2 text-sm ${
                location === "/marketplace"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Store className="h-4 w-4" />
              Marketplace
            </Button>
          </Link>
          <Link href="/favorites">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start gap-2 text-sm ${
                location === "/favorites"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Bookmark className="h-4 w-4" />
              Favoritos
            </Button>
          </Link>
          {isAuthenticated && (
            <Link href="/notifications">
              <Button
                variant="ghost"
                size="sm"
                className={`w-full justify-start gap-2 text-sm ${
                  location === "/notifications"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Bell className="h-4 w-4" />
                Notificações
                {unreadData && unreadData.count > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                    {unreadData.count}
                  </span>
                )}
              </Button>
            </Link>
          )}
        </div>

        {/* Footer */}
        <div className="text-xs text-muted-foreground px-4">
          <p>&copy; 2026 Inkwell</p>
          <p className="mt-1">Uma comunidade para leitores.</p>
        </div>
      </div>

      {/* Create Community Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Comunidade</DialogTitle>
            <DialogDescription>
              Crie uma nova comunidade para discutirmos sobre um tema específico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Poesia Contemporânea"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Sobre o que é esta comunidade?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Slug: <span className="font-mono text-primary">{slugify(name) || '...'}</span>
            </div>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createCommunity.isPending}
              className="w-full"
            >
              {createCommunity.isPending ? 'Criando...' : 'Criar Comunidade'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
