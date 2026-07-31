import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Streamdown } from "streamdown";
import {
  BookOpen, X, Send, Sparkles, Bot, User, Lightbulb, ChevronDown,
} from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Sugira livros para mim",
  "Qual livro devo ler a seguir?",
  "Me fale sobre literatura brasileira",
  "Analise meu histórico de leitura",
];

export default function ReadingAIAssistant() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const aiChat = trpc.ai.chat.useMutation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const result = await aiChat.mutateAsync({
        messages: newMessages,
        userBookHistory: true,
      });
      setMessages([...newMessages, { role: "assistant", content: result.content }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all duration-150"
          aria-label="Abrir assistente de leitura"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">Assistente de Leitura</span>
        </button>
      )}

      {/* Painel de chat */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200 ${
            minimized ? "h-14 w-72" : "h-[520px] w-[380px]"
          }`}
          style={{ maxHeight: "calc(100vh - 48px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold font-serif text-foreground">Inkwell AI</p>
                <p className="text-xs text-muted-foreground">Assistente de leitura</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized(!minimized)}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="rounded-2xl rounded-tl-sm bg-secondary px-3 py-2.5 text-sm text-foreground max-w-[85%]">
                        Olá! Sou o Inkwell AI, seu assistente de leitura. Posso sugerir livros com base no seu histórico, responder perguntas sobre literatura e analisar suas resenhas. Como posso ajudar?
                      </div>
                    </div>
                    <div className="pl-9">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" /> Sugestões rápidas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_PROMPTS.map((p) => (
                          <button
                            key={p}
                            onClick={() => sendMessage(p)}
                            className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-accent hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-0.5 ${
                      msg.role === "user" ? "bg-primary/20" : "bg-primary/10"
                    }`}>
                      {msg.role === "user"
                        ? <User className="h-3.5 w-3.5 text-primary" />
                        : <Bot className="h-3.5 w-3.5 text-primary" />
                      }
                    </div>
                    <div className={`rounded-2xl px-3 py-2.5 text-sm max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-foreground rounded-tl-sm"
                    }`}>
                      {msg.role === "assistant"
                        ? <div className="prose prose-sm max-w-none dark:prose-invert text-foreground [&>*]:text-foreground"><Streamdown>{msg.content}</Streamdown></div>
                        : msg.content
                      }
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-secondary px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{animationDelay:'0ms'}} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{animationDelay:'150ms'}} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{animationDelay:'300ms'}} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte sobre livros..."
                    className="min-h-[40px] max-h-[120px] resize-none text-sm py-2.5"
                    rows={1}
                    disabled={loading}
                  />
                  <Button
                    size="sm"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="h-10 w-10 p-0 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  Enter para enviar · Shift+Enter para nova linha
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
