import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { AuthDialog } from "@/components/AuthDialog";
import {
  BookOpen,
  Search,
  Menu,
  User,
  MessageSquare,
  LogOut,
  Flame,
  Bookmark,
  Heart,
  Bell,
  Sparkles,
  Sun,
  Moon,
  Trophy,
  X,
  Shield,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import BookImportDialog from "@/components/BookImportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme, switchable } = useTheme();

  const searchResults = trpc.search.global.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2, staleTime: 30000 }
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { href: "/feed", label: "Feed", icon: Flame },
    { href: "/marketplace", label: "Marketplace", icon: Heart },
    { href: "/weekly", label: "Semanal", icon: Sparkles },
    ...(isAuthenticated ? [{ href: "/messages", label: "Mensagens", icon: MessageSquare }] : []),
    ...(user?.role === "admin" ? [{ href: "/admin/moderation", label: "Moderação", icon: Shield }] : []),
  ];

  const isActive = (path: string) => location === path;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
      setShowResults(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">Inkwell</span>
        </Link>

        {/* Nav Links - Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button
                variant="ghost"
                size="sm"
                className={isActive(link.href) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}
              >
                <link.icon className="mr-1.5 h-4 w-4" />
                {link.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Search */}
        <div ref={searchRef} className="hidden md:flex flex-1 max-w-md mx-4 relative">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar posts, livros..."
              className="pl-9 bg-secondary/50 border-border h-9 text-sm"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(e.target.value.length >= 2);
              }}
              onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            />
          </form>

          {/* Search Results Dropdown */}
          {showResults && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-80 overflow-y-auto z-50">
              {searchResults.isLoading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Buscando...</div>
              ) : searchResults.data ? (
                <div className="py-2">
                  {searchResults.data.communities.length > 0 && (
                    <div className="px-3 pb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Comunidades</p>
                      {searchResults.data.communities.map((c) => (
                        <Link key={c.id} href={`/community/${c.slug}`} onClick={() => setShowResults(false)}>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
                            <BookOpen className="h-4 w-4 text-primary" />
                            <span>{c.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{c.memberCount} membros</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults.data.posts.length > 0 && (
                    <div className="px-3 pb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Posts</p>
                      {searchResults.data.posts.slice(0, 5).map((p) => (
                        <Link key={p.id} href={`/post/${p.id}`} onClick={() => setShowResults(false)}>
                          <div className="flex items-start gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
                            <Flame className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.title}</p>
                              <p className="text-xs text-muted-foreground">c/{p.communityName}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults.data.listings.length > 0 && (
                    <div className="px-3 pb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Marketplace</p>
                      {searchResults.data.listings.slice(0, 5).map((l) => (
                        <Link key={l.id} href={`/listing/${l.id}`} onClick={() => setShowResults(false)}>
                          <div className="flex items-start gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
                            <Heart className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{l.bookTitle}</p>
                              <p className="text-xs text-muted-foreground">R$ {l.price.toFixed(2)} • {l.condition}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults.data.posts.length === 0 && searchResults.data.listings.length === 0 && searchResults.data.communities.length === 0 && (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhum resultado encontrado</div>
                  )}
                </div>
              ) : null}
              {searchQuery.length >= 2 && (
                <div className="border-t border-border px-3 py-2">
                  <button onClick={() => { window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`; setShowResults(false); }} className="text-xs text-primary hover:underline w-full text-center">Ver todos os resultados</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          {switchable && (
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}

          {isAuthenticated && user ? (
            <>
              {/* Import Books - Desktop */}
              <div className="hidden md:block">
                <BookImportDialog
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
                      <Search className="h-3.5 w-3.5" />
                      Importar
                    </Button>
                  }
                />
              </div>
              {/* Notifications - Desktop */}
              <Link href="/notifications" className="hidden md:block">
                <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                  <Bell className="h-4 w-4" />
                  {unreadData && unreadData.count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                      {unreadData.count > 99 ? '99+' : unreadData.count}
                    </span>
                  )}
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 overflow-hidden">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <Link href={`/profile/${user.id}`}>
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      Meu Perfil
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/favorites">
                    <DropdownMenuItem>
                      <Bookmark className="mr-2 h-4 w-4" />
                      Favoritos
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/notifications" className="md:hidden">
                    <DropdownMenuItem>
                      <Bell className="mr-2 h-4 w-4" />
                      Notificações
                      {unreadData && unreadData.count > 0 && (
                        <Badge variant="destructive" className="ml-auto text-[10px] h-5">{unreadData.count}</Badge>
                      )}
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/messages">
                    <DropdownMenuItem>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Mensagens
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                        <BookOpen className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <span className="font-bold text-foreground">Inkwell</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <nav className="p-4 space-y-1">
                    {navLinks.map((link) => (
                      <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" size="sm" className={`w-full justify-start gap-2 ${isActive(link.href) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
                          <link.icon className="h-4 w-4" />
                          {link.label}
                        </Button>
                      </Link>
                    ))}
                    <Link href="/notifications" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                        <Bell className="h-4 w-4" />
                        Notificações
                        {unreadData && unreadData.count > 0 && (
                          <Badge variant="destructive" className="ml-auto text-[10px] h-5">{unreadData.count}</Badge>
                        )}
                      </Button>
                    </Link>
                    <Link href="/favorites" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                        <Bookmark className="h-4 w-4" />
                        Favoritos
                      </Button>
                    </Link>
                    <Link href="/messages" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        Mensagens
                      </Button>
                    </Link>
                    <div className="pt-3 border-t border-border mt-3">
                      <Link href={`/profile/${user.id}`} onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                          <Trophy className="h-4 w-4" />
                          Perfil
                        </Button>
                      </Link>
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <AuthDialog defaultTab="login">
              <Button size="sm">Entrar</Button>
            </AuthDialog>
          )}
        </div>
      </div>
    </nav>
  );
}
