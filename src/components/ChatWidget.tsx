import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Sparkles, Loader2 } from "lucide-react";
import { chatWithAIStream } from "@/services/aiService";
import { MarkdownContent } from "@/components/MarkdownContent";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "您好！我是 AI 智能助手，有什么可以帮您？" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    try {
      const history = next
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const stream = chatWithAIStream(text, history.slice(0, -1));
      let full = "";
      for await (const chunk of stream) {
        full += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: full };
          return updated;
        });
      }
      if (!full) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "（无回复）" };
          return updated;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      toast.error("AI 调用失败：" + msg);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "抱歉，AI 服务暂时不可用，请稍后再试或提交工单。" };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
          aria-label="打开 AI 助手"
        >
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(380px,72vh)] w-[calc(100vw-2rem)] max-w-[280px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl sm:bottom-6 sm:right-6 sm:h-[460px] sm:max-w-xs sm:rounded-2xl md:h-[500px] lg:h-[520px] lg:max-w-sm">
          <div className="flex items-center justify-between border-b bg-primary/5 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
              <div className="truncate text-xs font-semibold sm:text-sm">
                AI 智能助手（通义千问）
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3 sm:space-y-3 sm:p-4">
            {messages.map((m, i) => {
              const isStreaming =
                loading && m.role === "assistant" && i === messages.length - 1;
              return (
                <div
                  key={i}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                        : cn("bg-muted text-foreground", isStreaming && !!m.content && "streaming-cursor"),
                    )}
                  >
                    {m.role === "assistant" ? (
                      <MarkdownContent content={m.content} />
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              );
            })}
            {loading && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  正在分析问题
                  <span className="inline-flex w-4 animate-pulse">...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 border-t p-2 sm:gap-2 sm:p-3">
            <Input
              className="min-w-0 flex-1 text-sm sm:text-base"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="输入您的问题..."
              disabled={loading}
            />
            <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
