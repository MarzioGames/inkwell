import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CommunitiesSidebar from "@/components/CommunitiesSidebar";
import MobileCommunities from "@/components/MobileCommunities";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  BookOpen,
  Plus,
  Tag,
  Star,
  Image,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const conditionLabels: Record<string, string> = {
  new: "Novo",
  like_new: "Como Novo",
  good: "Bom",
  fair: "Regular",
  poor: "Usado",
};

const conditionColors: Record<string, string> = {
  new: "bg-green-500/10 text-green-400 border-green-500/20",
  like_new: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  good: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  fair: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  poor: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function MarketplacePage() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    bookTitle: "",
    author: "",
    price: "",
    condition: "good",
    description: "",
    imageUrl: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");

  const filterInput = useMemo(() => ({
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    condition: condition as any || undefined,
    query: search || undefined,
    limit: 40,
    offset: 0,
  }), [minPrice, maxPrice, condition, search]);

  const { data: listings, isLoading } = trpc.filteredListings.list.useQuery(filterInput);
  const utils = trpc.useUtils();

  const createListing = trpc.listings.create.useMutation({
    onSuccess: () => {
      toast.success("Anúncio criado com sucesso!");
      setDialogOpen(false);
      setForm({ title: "", bookTitle: "", author: "", price: "", condition: "good", description: "", imageUrl: "" });
      utils.filteredListings.list.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao criar anúncio", { description: error.message });
    },
  });

  const uploadImage = trpc.upload.uploadImage.useMutation({
    onSuccess: (data) => {
      setForm({ ...form, imageUrl: data.url });
      setUploadingImage(false);
      toast.success("Imagem enviada!");
    },
    onError: () => {
      setUploadingImage(false);
      toast.error("Erro ao enviar imagem");
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploadingImage(true);
    const reader2 = new FileReader();
    reader2.onloadend = () => {
      uploadImage.mutate({ fileName: file.name, data: reader2.result as string, contentType: file.type });
    };
    reader2.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!isAuthenticated) { startLogin(); return; }
    if (!form.title.trim() || !form.bookTitle.trim() || !form.author.trim() || !form.price) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createListing.mutate({
      title: form.title.trim(),
      bookTitle: form.bookTitle.trim(),
      author: form.author.trim(),
      price: parseFloat(form.price),
      condition: form.condition as any,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
    });
  };

  const featured = listings?.filter(l => l.featured) || [];
  const regular = listings?.filter(l => !l.featured) || [];

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

  const clearFilters = () => {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setCondition("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <MobileCommunities />
      <div className="flex-1 flex">
        <CommunitiesSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Compre e venda livros usados
                </p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Anunciar Livro
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Anunciar Livro Usado</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Título do anúncio *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    <Input placeholder="Título do livro *" value={form.bookTitle} onChange={(e) => setForm({ ...form, bookTitle: e.target.value })} />
                    <Input placeholder="Autor *" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
                    <div className="flex gap-2">
                      <Input placeholder="Preço (R$) *" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="flex-1" />
                      <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="like_new">Como Novo</SelectItem>
                          <SelectItem value="good">Bom</SelectItem>
                          <SelectItem value="fair">Regular</SelectItem>
                          <SelectItem value="poor">Usado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="resize-none" />
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Foto do livro (opcional)</label>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 transition-colors">
                            <Image className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{uploadingImage ? "Enviando..." : form.imageUrl ? "Imagem enviada" : "Enviar imagem"}</span>
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                        </label>
                        {imagePreview && (
                          <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-border" />
                        )}
                      </div>
                    </div>
                    <Button onClick={handleSubmit} disabled={createListing.isPending} className="w-full">
                      {createListing.isPending ? "Publicando..." : "Publicar Anúncio"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search + Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar livros, autores..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-secondary/50"
                />
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Faixa de preço</label>
                      <div className="flex gap-2">
                        <Input placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} type="number" />
                        <Input placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Condição</label>
                      <Select value={condition} onValueChange={setCondition}>
                        <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="like_new">Como Novo</SelectItem>
                          <SelectItem value="good">Bom</SelectItem>
                          <SelectItem value="fair">Regular</SelectItem>
                          <SelectItem value="poor">Usado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={clearFilters} className="w-full">Limpar filtros</Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Featured Listings */}
            {featured.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-400 font-medium">
                  <Sparkles className="h-4 w-4" />
                  Destaques
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {featured.map((listing) => (
                    <Link key={`featured-${listing.id}`} href={`/listing/${listing.id}`}>
                      <div className="rounded-xl border-2 border-amber-500/30 bg-card hover:border-amber-500/60 transition-all p-4 cursor-pointer group">
                        {listing.imageUrl ? (
                          <div className="h-32 rounded-lg bg-secondary mb-3 overflow-hidden">
                            <img src={listing.imageUrl} alt={listing.bookTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          </div>
                        ) : (
                          <div className="h-32 rounded-lg bg-secondary mb-3 flex items-center justify-center">
                            <BookOpen className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex items-center gap-1 mb-1">
                          <Sparkles className="h-3 w-3 text-amber-400" />
                          <span className="text-xs font-medium text-amber-400">Destaque</span>
                        </div>
                        <h3 className="font-semibold text-sm text-foreground line-clamp-1 mb-0.5">{listing.bookTitle}</h3>
                        <p className="text-xs text-muted-foreground mb-2">por {listing.author}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-primary">R$ {listing.price.toFixed(2)}</span>
                          <Badge variant="outline" className={`text-xs ${conditionColors[listing.condition]}`}>{conditionLabels[listing.condition]}</Badge>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">por {listing.authorName}</span>
                          <span className="text-xs text-muted-foreground">{timeAgo(listing.createdAt)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Listings */}
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-48 rounded-xl" />))}
              </div>
            ) : regular.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {regular.map((listing) => (
                  <Link key={listing.id} href={`/listing/${listing.id}`}>
                    <div className="rounded-xl border border-border bg-card hover:border-primary/30 transition-all p-4 cursor-pointer group">
                      {listing.imageUrl ? (
                        <div className="h-32 rounded-lg bg-secondary mb-3 overflow-hidden">
                          <img src={listing.imageUrl} alt={listing.bookTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                      ) : (
                        <div className="h-32 rounded-lg bg-secondary mb-3 flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <h3 className="font-semibold text-sm text-foreground line-clamp-1 mb-0.5">{listing.bookTitle}</h3>
                      <p className="text-xs text-muted-foreground mb-2">por {listing.author}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">R$ {listing.price.toFixed(2)}</span>
                        <Badge variant="outline" className={`text-xs ${conditionColors[listing.condition]}`}>{conditionLabels[listing.condition]}</Badge>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">por {listing.authorName}</span>
                        <div className="flex items-center gap-1">
                          {listing.sellerRating > 0 && (
                            <span className="text-xs text-amber-400 flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-amber-400" />
                              {listing.sellerRating.toFixed(1)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{timeAgo(listing.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground text-lg mb-2">Nenhum livro encontrado</p>
                <p className="text-muted-foreground text-sm mb-4">Tente ajustar os filtros ou anunciar um livro</p>
                <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Anunciar Livro
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
