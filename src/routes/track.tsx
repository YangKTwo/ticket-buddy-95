import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LifeBuoy,
  Search,
  Clock,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "查询工单进度 — 客服支持" },
      { name: "description", content: "输入您的邮箱，查看已提交工单的处理进度和回复。" },
    ],
  }),
  component: TrackTicketPage,
});

const emailSchema = z.string().trim().email("请输入有效的邮箱");

type Ticket = {
  id: string;
  title: string;
  description: string;
  email: string;
  status: "pending" | "processing" | "resolved";
  created_at: string;
  updated_at: string;
};

type Reply = {
  id: string;
  ticket_id: string;
  content: string;
  is_ai_generated: boolean;
  created_at: string;
};

const STATUS_LABEL: Record<Ticket["status"], string> = {
  pending: "待处理",
  processing: "处理中",
  resolved: "已解决",
};

const STATUS_VARIANT: Record<Ticket["status"], "secondary" | "default" | "outline"> = {
  pending: "secondary",
  processing: "default",
  resolved: "outline",
};

const STATUS_ICON: Record<Ticket["status"], typeof Clock> = {
  pending: Clock,
  processing: Clock,
  resolved: CheckCircle2,
};

function TrackTicketPage() {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "请输入有效邮箱");
      return;
    }
    setSearching(true);
    setSearched(true);

    const { data: ticketData, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("email", parsed.data)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("查询失败：" + error.message);
      setSearching(false);
      return;
    }

    const fetchedTickets = (ticketData ?? []) as Ticket[];
    setTickets(fetchedTickets);

    // Fetch replies for all tickets
    if (fetchedTickets.length > 0) {
      const ticketIds = fetchedTickets.map((t) => t.id);
      const { data: replyData } = await supabase
        .from("replies")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      const grouped: Record<string, Reply[]> = {};
      for (const r of (replyData ?? []) as Reply[]) {
        if (!grouped[r.ticket_id]) grouped[r.ticket_id] = [];
        grouped[r.ticket_id].push(r);
      }
      setReplies(grouped);
    } else {
      setReplies({});
    }

    setSearching(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold hover:opacity-80">
            <LifeBuoy className="h-5 w-5 text-primary" />
            客服支持中心
          </Link>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            管理员登录
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Card className="w-full shadow-sm">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl">查询工单进度</CardTitle>
            <CardDescription>
              输入您提交工单时使用的邮箱，即可查看处理进度和回复。
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleSearch} className="w-full space-y-4">
              <div className="w-full min-w-0 space-y-2">
                <Label htmlFor="track-email">联系人邮箱</Label>
                <div className="flex gap-2">
                  <Input
                    id="track-email"
                    type="email"
                    className="min-w-0 flex-1"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                  <Button type="submit" disabled={searching}>
                    {searching ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-1 h-4 w-4" />
                    )}
                    查询
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && !searching && (
          <div className="mt-6 space-y-4">
            {tickets.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="py-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">未找到工单</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    该邮箱暂无工单记录，如有问题请
                    <Link to="/" className="mx-1 text-primary hover:underline">
                      提交新工单
                    </Link>
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  找到 <span className="font-medium text-foreground">{tickets.length}</span> 个工单
                </p>
                {tickets.map((ticket) => {
                  const isExpanded = expandedId === ticket.id;
                  const ticketReplies = replies[ticket.id] ?? [];
                  const StatusIcon = STATUS_ICON[ticket.status];

                  return (
                    <Card
                      key={ticket.id}
                      className={cn(
                        "shadow-sm transition-shadow hover:shadow-md",
                        isExpanded && "ring-1 ring-primary/20",
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => toggleExpand(ticket.id)}
                      >
                        <CardContent className="flex items-start justify-between p-4">
                          <div className="min-w-0 flex-1 space-y-1.5 pr-3">
                            <h3 className="font-medium leading-snug">{ticket.title}</h3>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {new Date(ticket.created_at).toLocaleString("zh-CN")}
                              </span>
                              <Badge
                                variant={STATUS_VARIANT[ticket.status]}
                                className="h-5 gap-1 px-1.5 text-xs"
                              >
                                <StatusIcon className="h-3 w-3" />
                                {STATUS_LABEL[ticket.status]}
                              </Badge>
                              {ticketReplies.length > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3" />
                                  {ticketReplies.length} 条回复
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-0.5 shrink-0 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </div>
                        </CardContent>
                      </button>

                      {isExpanded && (
                        <div className="border-t px-4 pb-4 pt-3">
                          {/* Original description */}
                          <div className="mb-4">
                            <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                              问题描述
                            </div>
                            <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                              {ticket.description}
                            </div>
                          </div>

                          {/* Replies */}
                          {ticketReplies.length > 0 && (
                            <div>
                              <div className="mb-2 text-xs font-medium text-muted-foreground">
                                客服回复
                              </div>
                              <div className="space-y-3">
                                {ticketReplies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className="flex gap-2.5"
                                  >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                      {reply.is_ai_generated ? (
                                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                                      ) : (
                                        <User className="h-3.5 w-3.5 text-primary" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium">
                                          {reply.is_ai_generated ? "AI 助手" : "客服"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(reply.created_at).toLocaleString("zh-CN")}
                                        </span>
                                      </div>
                                      <div className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm">
                                        {reply.content}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {ticketReplies.length === 0 && (
                            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                              暂无回复，客服将尽快处理您的工单
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
