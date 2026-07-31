import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert, Ban, Trash2, MessageSquareWarning, X } from "lucide-react";

const reasonLabels: Record<string, string> = {
  spam: "Spam",
  harassment: "Assédio",
  hate_speech: "Discurso de ódio",
  misinformation: "Desinformação",
  nsfw: "Conteúdo impróprio",
  copyright: "Direitos autorais",
  other: "Outro",
};

export default function AdminModerationPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"pending" | "reviewed" | "resolved" | "dismissed">("pending");
  const [banDurationDays, setBanDurationDays] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();

  const { data: stats } = trpc.moderation.stats.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: reports, isLoading } = trpc.moderation.listReports.useQuery(
    { status: statusFilter },
    { enabled: user?.role === "admin" }
  );

  const reviewReport = trpc.moderation.reviewReport.useMutation({
    onSuccess: () => {
      utils.moderation.listReports.invalidate();
      utils.moderation.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Faça login</h1>
            <Button onClick={startLogin}>Entrar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h1 className="text-xl font-bold text-foreground mb-1">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground">Esta página é só para administradores.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleAction = (reportId: number, action: "dismiss" | "delete_content" | "warn" | "ban_user") => {
    const days = banDurationDays[reportId];
    reviewReport.mutate({
      reportId,
      action,
      banDurationDays: action === "ban_user" && days ? Number(days) : undefined,
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Moderação</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stats ? `${stats.pendingReports} denúncia(s) pendente(s) · ${stats.totalBans} usuário(s) banido(s)` : "Carregando..."}
            </p>
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="reviewed">Revisadas</SelectItem>
              <SelectItem value="resolved">Resolvidas</SelectItem>
              <SelectItem value="dismissed">Descartadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-secondary rounded-lg animate-pulse" />)}
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{r.targetType}</Badge>
                      <Badge variant="secondary">{reasonLabels[r.reason] ?? r.reason}</Badge>
                      <span className="text-xs text-muted-foreground">#{r.targetId}</span>
                    </div>
                    <p className="text-sm text-foreground">{r.description || "Sem descrição adicional"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Denunciado por {r.reporterName} em {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                {statusFilter === "pending" && (
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "dismiss")} disabled={reviewReport.isPending}>
                      <X className="h-3 w-3 mr-1" /> Descartar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "warn")} disabled={reviewReport.isPending}>
                      <MessageSquareWarning className="h-3 w-3 mr-1" /> Avisar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "delete_content")} disabled={reviewReport.isPending}>
                      <Trash2 className="h-3 w-3 mr-1" /> Apagar conteúdo
                    </Button>
                    <div className="flex items-center gap-1 ml-auto">
                      <input
                        type="number"
                        placeholder="dias (vazio=permanente)"
                        className="h-8 w-40 text-xs rounded-md border border-input bg-background px-2"
                        value={banDurationDays[r.id] ?? ""}
                        onChange={(e) => setBanDurationDays((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      />
                      <Button size="sm" variant="destructive" onClick={() => handleAction(r.id, "ban_user")} disabled={reviewReport.isPending}>
                        <Ban className="h-3 w-3 mr-1" /> Banir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-lg">Nenhuma denúncia por aqui</p>
          </div>
        )}
      </main>
    </div>
  );
}
