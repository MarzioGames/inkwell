import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CommunitiesSidebar from "@/components/CommunitiesSidebar";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { MessageSquare, Send, ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MessagesPage() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Parse room from URL query
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setSelectedRoomId(parseInt(roomParam));
    }
  }, [location]);

  const { data: rooms, isLoading: roomsLoading } = trpc.chat.getRooms.useQuery(
    undefined,
    { enabled: !!isAuthenticated }
  );

  const { data: selectedRoom } = trpc.chat.getRoomById.useQuery(
    { id: selectedRoomId ?? 0 },
    { enabled: !!selectedRoomId }
  );

  const { data: messages, isLoading: messagesLoading } = trpc.chat.listMessages.useQuery(
    { roomId: selectedRoomId ?? 0 },
    { enabled: !!selectedRoomId }
  );

  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage("");
      trpc.useUtils().chat.listMessages.invalidate({ roomId: selectedRoomId! });
    },
    onError: (error) => {
      toast.error("Erro ao enviar mensagem", { description: error.message });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!message.trim() || !selectedRoomId) return;
    sendMessage.mutate({ roomId: selectedRoomId, content: message.trim() });
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Faça login</h1>
            <p className="text-muted-foreground mb-4">Entre para ver suas mensagens</p>
            <Button onClick={startLogin}>Entrar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex">
        <CommunitiesSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-foreground mb-4">Mensagens</h1>

            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[600px]">
              {/* Rooms list */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-muted-foreground">Conversas</h2>
                </div>
                <ScrollArea className="h-[calc(100%-49px)]">
                  {roomsLoading ? (
                    <div className="space-y-2 p-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                      ))}
                    </div>
                  ) : rooms && rooms.length > 0 ? (
                    <div className="space-y-0.5 p-1">
                      {rooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoomId(room.id)}
                          className={`w-full p-3 rounded-lg text-left transition-colors ${
                            selectedRoomId === room.id
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-accent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                Anúncio #{room.listingId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {room.buyerId === user?.id ? "Comprador" : "Vendedor"}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhuma conversa ainda
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Chat area */}
              <div className="rounded-xl border border-border bg-card flex flex-col overflow-hidden">
                {selectedRoomId && selectedRoom ? (
                  <>
                    {/* Chat header */}
                    <div className="p-3 border-b border-border flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRoomId(null)}
                        className="md:hidden p-1 hover:bg-accent rounded"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <h3 className="text-sm font-semibold text-foreground">
                        Anúncio #{selectedRoom.listingId}
                      </h3>
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4">
                      {messagesLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-10 w-2/3 rounded-lg" />
                          ))}
                        </div>
                      ) : messages && messages.length > 0 ? (
                        <div className="space-y-3">
                          {messages.map((msg) => {
                            const isMe = msg.senderId === user?.id;
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-xl px-3 py-2 ${
                                    isMe
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-secondary text-foreground"
                                  }`}
                                >
                                  {!isMe && (
                                    <p className="text-xs font-medium mb-0.5 opacity-70">
                                      {msg.authorName}
                                    </p>
                                  )}
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {msg.content}
                                  </p>
                                  <p className="text-xs mt-1 opacity-60 text-right">
                                    {timeAgo(msg.createdAt)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-sm text-muted-foreground">
                            Inicie a conversa
                          </p>
                        </div>
                      )}
                    </ScrollArea>

                    <Separator />

                    {/* Input */}
                    <div className="p-3 flex gap-2">
                      <Input
                        placeholder="Digite uma mensagem..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={sendMessage.isPending || !message.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-muted-foreground">
                        Selecione uma conversa para começar
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
