import { useParams, Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CommunitiesSidebar from "@/components/CommunitiesSidebar";
import MobileCommunities from "@/components/MobileCommunities";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  BookOpen,
  BookMarked,
  BookCheck,
  Star,
  Target,
  Edit2,
  Save,
  Camera,
  Calendar,
  MessageSquare,
  Plus,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// ── Componente de card de livro da biblioteca ──────────────────────────
function LibraryBookCard({ item }: { item: any }) {
  const statusColors: Record<string, string> = {
    read: "bg-green-500/10 text-green-700 border-green-500/20",
    reading: "bg-primary/10 text-primary border-primary/20",
    want_to_read: "bg-muted text-muted-foreground border-border",
  };
  const statusLabels: Record<string, string> = {
    read: "Lido", reading: "Lendo", want_to_read: "Quero Ler",
  };
  return (
    <Link href={`/book/${item.bookId}`}>
      <div className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-accent/20 transition-all cursor-pointer group">
        {item.book?.coverUrl ? (
          <img src={item.book.coverUrl} alt={item.book.title} className="w-12 rounded object-cover flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform" style={{height:'72px'}} />
        ) : (
          <div className="w-12 rounded bg-secondary flex items-center justify-center flex-shrink-0" style={{height:'72px'}}>
            <BookOpen className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground line-clamp-2 font-serif group-hover:text-primary transition-colors">{item.book?.title ?? 'Livro'}</p>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.book?.author}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className={`text-xs px-1.5 py-0 h-4 ${statusColors[item.status] ?? ''}`}>{statusLabels[item.status] ?? item.status}</Badge>
            {item.rating && (
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(s => <Star key={s} className={`h-2.5 w-2.5 ${s <= item.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />)}
              </div>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 self-center group-hover:text-primary transition-all" />
      </div>
    </Link>
  );
}

function ReadingGoalSection({ isOwn }: { isOwn: boolean }) {
  const currentYear = new Date().getFullYear();
  const { data: goal } = trpc.readingGoals.get.useQuery({ year: currentYear }, { enabled: isOwn });
  const { data: stats } = trpc.readingList.stats.useQuery(undefined, { enabled: isOwn });
  const [targetBooks, setTargetBooks] = useState(12);
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  const createGoal = trpc.readingGoals.create.useMutation({
    onSuccess: () => { toast.success("Meta criada!"); setDialogOpen(false); utils.readingGoals.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  if (!isOwn) return null;
  const booksRead = stats?.read ?? 0;
  const target = goal?.targetBooks ?? 0;
  const progress = target > 0 ? Math.min(100, Math.round((booksRead / target) * 100)) : 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold font-serif">Meta de Leitura {currentYear}</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" />{goal ? "Editar" : "Definir Meta"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader><DialogTitle className="font-serif">Meta de Leitura {currentYear}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium">Quantos livros você quer ler?</label>
                <Input type="number" min={1} max={365} value={targetBooks} onChange={(e) => setTargetBooks(parseInt(e.target.value) || 1)} className="mt-1.5" />
              </div>
              <Button className="w-full" onClick={() => createGoal.mutate({ year: currentYear, targetBooks })} disabled={createGoal.isPending}>
                {createGoal.isPending ? "Salvando..." : "Salvar Meta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {goal ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{booksRead} de {goal.targetBooks} livros</span>
            <span className="font-semibold text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{progress >= 100 ? "🎉 Meta atingida! Parabéns!" : `Faltam ${goal.targetBooks - booksRead} livros para atingir sua meta`}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Defina uma meta de leitura para {currentYear}</p>
      )}
    </div>
  );
}

function ReadingStats({ isOwn }: { isOwn: boolean }) {
  const { data: stats, isLoading } = trpc.readingList.stats.useQuery(undefined, { enabled: isOwn });
  if (!isOwn) return null;
  if (isLoading) return <Skeleton className="h-20 rounded-xl" />;
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { icon: BookCheck, label: "Lidos", value: stats?.read ?? 0, color: "text-green-600" },
        { icon: BookOpen, label: "Lendo", value: stats?.reading ?? 0, color: "text-primary" },
        { icon: BookMarked, label: "Quero Ler", value: stats?.wantToRead ?? 0, color: "text-muted-foreground" },
      ].map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-3 text-center">
          <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
          <p className="text-xl font-bold font-serif text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

function DigitalLibrary({ isOwn }: { isOwn: boolean }) {
  const { data: readingList, isLoading } = trpc.readingList.get.useQuery({ status: undefined }, { enabled: isOwn });
  if (!isOwn) return <p className="text-sm text-muted-foreground text-center py-8">Biblioteca privada</p>;
  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>;
  const read = (readingList ?? []).filter(i => i.status === 'read');
  const reading = (readingList ?? []).filter(i => i.status === 'reading');
  const wantToRead = (readingList ?? []).filter(i => i.status === 'want_to_read');
  return (
    <Tabs defaultValue="reading">
      <TabsList className="mb-4 w-full">
        <TabsTrigger value="reading" className="flex-1 gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Lendo ({reading.length})</TabsTrigger>
        <TabsTrigger value="read" className="flex-1 gap-1.5"><BookCheck className="h-3.5 w-3.5" /> Lidos ({read.length})</TabsTrigger>
        <TabsTrigger value="want" className="flex-1 gap-1.5"><BookMarked className="h-3.5 w-3.5" /> Quero Ler ({wantToRead.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="reading">
        {reading.length === 0 ? <div className="text-center py-8"><BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhum livro em andamento</p></div>
          : <div className="space-y-2">{reading.map(item => <LibraryBookCard key={item.id} item={item} />)}</div>}
      </TabsContent>
      <TabsContent value="read">
        {read.length === 0 ? <div className="text-center py-8"><BookCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhum livro lido ainda</p></div>
          : <div className="space-y-2">{read.map(item => <LibraryBookCard key={item.id} item={item} />)}</div>}
      </TabsContent>
      <TabsContent value="want">
        {wantToRead.length === 0 ? <div className="text-center py-8"><BookMarked className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Lista de desejos vazia</p></div>
          : <div className="space-y-2">{wantToRead.map(item => <LibraryBookCard key={item.id} item={item} />)}</div>}
      </TabsContent>
    </Tabs>
  );
}

function UserReviews({ isOwn }: { isOwn: boolean }) {
  const { data: readingList } = trpc.readingList.get.useQuery({ status: 'read' }, { enabled: isOwn });
  const reviewedBooks = (readingList ?? []).filter(item => item.review || item.rating);
  if (!isOwn) return <p className="text-sm text-muted-foreground text-center py-8">Resenhas privadas</p>;
  if (reviewedBooks.length === 0) return (
    <div className="text-center py-8">
      <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Nenhuma resenha ainda</p>
      <p className="text-xs text-muted-foreground mt-1">Marque livros como lidos e adicione uma avaliação</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {reviewedBooks.map(item => (
        <Link key={item.id} href={`/book/${item.bookId}`}>
          <div className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-all cursor-pointer">
            <div className="flex gap-3">
              {item.book?.coverUrl ? (
                <img src={item.book.coverUrl} alt={item.book.title} className="w-10 rounded object-cover flex-shrink-0" style={{height:'60px'}} />
              ) : (
                <div className="w-10 rounded bg-secondary flex items-center justify-center flex-shrink-0" style={{height:'60px'}}><BookOpen className="h-4 w-4 text-muted-foreground/40" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold font-serif text-foreground line-clamp-1">{item.book?.title}</p>
                <p className="text-xs text-muted-foreground">{item.book?.author}</p>
                {item.rating && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`h-3 w-3 ${s <= item.rating! ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />)}
                  </div>
                )}
                {item.review && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">"{item.review}"</p>}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ProfilePostsList({ userId }: { userId: number }) {
  const { data: posts } = trpc.posts.getByAuthor.useQuery({ authorId: userId });
  if (!posts || posts.length === 0) return (
    <div className="text-center py-8">
      <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Nenhum post publicado</p>
    </div>
  );
  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <Link key={post.id} href={`/post/${post.id}`}>
          <div className="rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors cursor-pointer group">
            <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">{post.communityName}</Badge>
              <span>{new Date(post.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams<{ userId: string }>();
  const profileUserId = parseInt(params.userId ?? "0");
  const { user: currentUser, isAuthenticated } = useAuth();
  const isOwn = isAuthenticated && currentUser?.id === profileUserId;
  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery({ userId: profileUserId });
  const { data: postCount } = trpc.posts.countByAuthor.useQuery({ authorId: profileUserId });
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const utils = trpc.useUtils();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => { toast.success("Perfil atualizado!"); setEditing(false); utils.profile.get.invalidate({ userId: profileUserId }); },
    onError: (e) => toast.error(e.message),
  });
  const handleEdit = () => { setDisplayName((profile as any)?.displayName ?? ""); setBio((profile as any)?.bio ?? ""); setAvatarUrl((profile as any)?.avatarUrl ?? ""); setEditing(true); };
  const handleSave = () => updateProfile.mutate({ displayName: displayName.trim() || undefined, bio: bio.trim() || undefined, avatarUrl: avatarUrl || undefined });
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) setAvatarUrl(data.url);
    } catch { toast.error("Erro ao fazer upload"); }
    finally { setUploadingAvatar(false); }
  };
  if (profileLoading) return (
    <div className="min-h-screen flex flex-col bg-background"><Navbar />
      <div className="flex-1 flex"><CommunitiesSidebar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-32 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-64 rounded-xl" />
        </main>
      </div>
    </div>
  );
  const p = profile as any;
  const displayNameValue = p?.displayName ?? p?.user?.name ?? `Usuário #${profileUserId}`;
  const initials = displayNameValue.slice(0, 2).toUpperCase();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar /><MobileCommunities />
      <div className="flex-1 flex"><CommunitiesSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
            {/* Cabeçalho */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 border-2 border-border shrink-0">
                  <AvatarImage src={p?.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xl font-serif bg-secondary text-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h1 className="text-xl font-bold font-serif text-foreground">{displayNameValue}</h1>
                      {p?.user?.email && <p className="text-xs text-muted-foreground mt-0.5">{p.user.email}</p>}
                    </div>
                    {isOwn && !editing && (
                      <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1.5 shrink-0">
                        <Edit2 className="h-3.5 w-3.5" /> Editar
                      </Button>
                    )}
                  </div>
                  {p?.bio && !editing && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{p.bio}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {postCount ?? 0} posts</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Membro desde {p?.user?.createdAt ? new Date(p.user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
              </div>
              {editing && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <Input placeholder="Nome de exibição" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Camera className="h-4 w-4" />{uploadingAvatar ? "Enviando..." : "Trocar foto"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    </label>
                    {avatarUrl && <img src={avatarUrl} alt="Preview" className="w-8 h-8 rounded-full object-cover border border-border" />}
                  </div>
                  <Textarea placeholder="Sua bio..." value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="resize-none" maxLength={500} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" />{updateProfile.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
            <ReadingStats isOwn={isOwn} />
            <ReadingGoalSection isOwn={isOwn} />
            <Tabs defaultValue="library">
              <TabsList className="w-full">
                <TabsTrigger value="library" className="flex-1 gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Biblioteca</TabsTrigger>
                <TabsTrigger value="reviews" className="flex-1 gap-1.5"><Star className="h-3.5 w-3.5" /> Resenhas</TabsTrigger>
                <TabsTrigger value="posts" className="flex-1 gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Posts</TabsTrigger>
              </TabsList>
              <TabsContent value="library" className="mt-4"><DigitalLibrary isOwn={isOwn} /></TabsContent>
              <TabsContent value="reviews" className="mt-4"><UserReviews isOwn={isOwn} /></TabsContent>
              <TabsContent value="posts" className="mt-4"><ProfilePostsList userId={profileUserId} /></TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
