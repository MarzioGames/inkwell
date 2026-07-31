import { Link } from "wouter";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/AuthDialog";
import {
  BookOpen,
  MessageSquare,
  Store,
  ArrowRight,
  Heart,
  Rocket,
  Shield,
  Flag,
  Users,
  TrendingUp,
  Search,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">Inkwell</span>
          </Link>
          <div className="flex items-center gap-2">
            <AuthDialog defaultTab="login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </AuthDialog>
            <AuthDialog defaultTab="register">
              <Button size="sm">
                Começar
              </Button>
            </AuthDialog>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
              <TrendingUp className="h-3.5 w-3.5" />
              Comunidade de leitores em crescimento
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight leading-tight mb-6">
              Onde leitores se{" "}
              <span className="text-primary">encontram</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discussaoes sobre livros, marketplace de livros usados e chats com vendedores.
              Tudo em um só lugar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <AuthDialog defaultTab="register">
                <Button size="lg" className="gap-2 h-12 px-8 text-base">
                  Criar conta grátis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </AuthDialog>
              <Link href="/marketplace">
                <Button variant="outline" size="lg" className="gap-2 h-12 px-8 text-base">
                  <Store className="h-4 w-4" />
                  Explorar Marketplace
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Tudo que você precisa como leitor
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              De discussões a compras, o Inkwell conecta você à comunidade.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Fórum de Discussão</h3>
              <p className="text-sm text-muted-foreground">
                Compartilhe opiniões, descubra livros e participe de debates em comunidades temáticas.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Marketplace</h3>
              <p className="text-sm text-muted-foreground">
                Compre e venda livros usados com segurança via Stripe. Condiçao, preco e fotos.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Chat Integrado</h3>
              <p className="text-sm text-muted-foreground">
                Converse diretamente com compradores e vendedores vinculado ao anúncio do livro.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Communities */}
      <section className="border-t border-border py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-3">Comunidades</h2>
            <p className="text-muted-foreground">Explore e participe das nossas comunidades de livros</p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { name: "Desenvolvimento Pessoal", icon: BookOpen, slug: "desenvolvimento-pessoal" },
              { name: "Romance", icon: Heart, slug: "romance" },
              { name: "Ficção Científica", icon: Rocket, slug: "ficcao-cientifica" },
              { name: "Thrillers", icon: Shield, slug: "thrillers" },
              { name: "Literatura Brasileira", icon: Flag, slug: "literatura-brasileira" },
            ].map((community) => (
              <Link key={community.slug} href={`/community/${community.slug}`}>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <community.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{community.name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-16">
        <div className="container text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Pronto para comecar?
          </h2>
          <p className="text-muted-foreground mb-6">
            Junte-se a milhares de leitores que já estão no Inkwell.
          </p>
          <AuthDialog defaultTab="register">
            <Button size="lg" className="gap-2 h-12 px-8 text-base">
              Criar minha conta
              <ArrowRight className="h-4 w-4" />
            </Button>
          </AuthDialog>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Inkwell &copy; 2026</span>
            </div>
            <p className="text-xs text-muted-foreground">Uma comunidade para leitores.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
