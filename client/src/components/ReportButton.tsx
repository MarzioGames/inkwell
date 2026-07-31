import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const reasons = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Assédio" },
  { value: "hate_speech", label: "Discurso de ódio" },
  { value: "misinformation", label: "Desinformação" },
  { value: "nsfw", label: "Conteúdo impróprio" },
  { value: "copyright", label: "Direitos autorais" },
  { value: "other", label: "Outro" },
] as const;

type Reason = (typeof reasons)[number]["value"];

export default function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "post" | "comment" | "listing" | "user";
  targetId: number;
}) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("spam");
  const [description, setDescription] = useState("");

  const report = trpc.moderation.reportContent.useMutation({
    onSuccess: () => {
      toast.success("Denúncia enviada. Nossa equipe vai revisar.");
      setOpen(false);
      setDescription("");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAuthenticated) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Flag className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar conteúdo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Detalhes (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={report.isPending}
              onClick={() => report.mutate({ targetType, targetId, reason, description: description || undefined })}
            >
              Enviar denúncia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
