import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FavoriteButtonProps {
  targetType: "post" | "listing";
  targetId: number;
}

export default function FavoriteButton({ targetType, targetId }: FavoriteButtonProps) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: favStatus } = trpc.favorites.isFavorite.useQuery(
    { targetType, targetId },
    { enabled: !!isAuthenticated }
  );

  const toggle = trpc.favorites.toggle.useMutation({
    onSuccess: (data) => {
      utils.favorites.isFavorite.invalidate({ targetType, targetId });
      utils.favorites.getPostFavorites.invalidate();
      utils.favorites.getListingFavorites.invalidate();
      toast.success(
        data.status === "added" ? "Adicionado aos favoritos!" : "Removido dos favoritos"
      );
    },
    onError: () => {
      toast.error("Erro ao atualizar favorito");
    },
  });

  const handleClick = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    toggle.mutate({ targetType, targetId });
  };

  const isFavorited = favStatus?.isFavorite ?? false;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={`gap-1.5 transition-all ${
        isFavorited
          ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
          : "text-muted-foreground hover:text-foreground"
      }`}
      disabled={toggle.isPending}
    >
      <Bookmark
        className={`h-4 w-4 ${isFavorited ? "fill-primary" : ""}`}
      />
      {isFavorited ? "Salvo" : "Salvar"}
    </Button>
  );
}
