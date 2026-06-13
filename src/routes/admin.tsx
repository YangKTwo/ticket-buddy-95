import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { generateAIReply } from "@/services/aiService";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  LifeBuoy,
  LogOut,
  Inbox,
  Clock,
  CheckCircle2,
  ListFilter,
  Eye,
  Sparkles,
  Loader2,
  Menu,
  Search,
  Send,
  User,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "工单管理 — 客服支持" }] }),
  component: AdminPage,
});

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

const PAGE_SIZE = 10;

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

function AdminPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<"all" | Ticket["status"]>("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [ticketReplies, setTicketReplies] = useState<Reply[]>([]);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/login", replace: true });
      } else {
        setAuthChecked(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // Fetch _all_ tickets once for stats (no pagination on stats)
  const fetchAllForStats = useCallback(async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setAllTickets(data as Ticket[]);
    }
  }, []);

  // Fetch paginated tickets with optional status filter and search
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("tickets").select("*", { count: "exact" });
    if (filter !== "all") {
      query = query.eq("status", filter);
    }
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`title.ilike.${term},email.ilike.${term}`);
    }
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    setLoading(false);
    if (error) {
      toast.error("加载工单失败：" + error.message);
      return;
    }
    setTickets((data ?? []) as Ticket[]);
    setTotalCount(count ?? 0);
  }, [filter, page, search]);

  useEffect(() => {
    if (authChecked) {
      fetchAllForStats();
      fetchTickets();
    }
  }, [authChecked, fetchTickets, fetchAllForStats]);

  // Reset page when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  // Fetch replies when a ticket is selected
  useEffect(() => {
    if (!selected) {
      setTicketReplies([]);
      return;
    }
    supabase
      .from("replies")
      .select("*")
      .eq("ticket_id", selected.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setTicketReplies((data ?? []) as Reply[]));
  }, [selected]);

  const stats = useMemo(
    () => ({
      total: allTickets.length,
      pending: allTickets.filter((t) => t.status === "pending").length,
      resolved: allTickets.filter((t) => t.status === "resolved").length,
    }),
    [allTickets],
  );

  const updateStatus = async (id: string, status: Ticket["status"]) => {
    const prev = tickets;
    setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    setAllTickets((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) {
      setTickets(prev);
      toast.error("更新失败：" + error.message);
    } else {
      toast.success("状态已更新");
    }
  };

  const handleGenerateAI = async (t: Ticket) => {
    setAiLoadingId(t.id);
    try {
      const reply = await generateAIReply(t.title, t.description);
      setReplies((r) => ({ ...r, [t.id]: reply }));
      setSelected(t);
      toast.success("AI 回复已生成");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      toast.error("生成失败：" + msg);
    } finally {
      setAiLoadingId(null);
    }
  };

  const handleSendReply = async (ticket: Ticket) => {
    const content = (replies[ticket.id] ?? "").trim();
    if (!content) {
      toast.error("请先输入或生成回复内容");
      return;
    }
    setSendingReply(true);
    setReplyingTicketId(ticket.id);
    const isAiGenerated = aiLoadingId === ticket.id || replies[ticket.id]?.length > 0;
    const { error } = await supabase.from("replies").insert({
      ticket_id: ticket.id,
      content,
      is_ai_generated: false,
    });
    if (error) {
      toast.error("发送失败：" + error.message);
      setSendingReply(false);
      setReplyingTicketId(null);
      return;
    }

    // If ticket was pending, move to processing
    if (ticket.status === "pending") {
      await supabase.from("tickets").update({ status: "processing" }).eq("id", ticket.id);
      setTickets((ts) =>
        ts.map((t) => (t.id === ticket.id ? { ...t, status: "processing" as const } : t)),
      );
      setAllTickets((ts) =>
        ts.map((t) => (t.id === ticket.id ? { ...t, status: "processing" as const } : t)),
      );
    }

    toast.success("回复已发送");
    setReplies((r) => ({ ...r, [ticket.id]: "" }));

    // Refresh replies
    const { data: freshReplies } = await supabase
      .from("replies")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setTicketReplies((freshReplies ?? []) as Reply[]);

    setSendingReply(false);
    setReplyingTicketId(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  // Build page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Desktop sidebar — fixed, independent scroll */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
        <AdminSidebarNav onLogout={handleLogout} />
      </aside>

      {/* Mobile sidebar (default closed) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(100vw-2rem,18rem)] p-0 sm:max-w-xs">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <AdminSidebarNav
            onLogout={() => {
              setMobileNavOpen(false);
              handleLogout();
            }}
            onNavClick={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main — fills remaining width, no page-level scroll */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Fixed top header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="打开菜单"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="truncate text-base font-semibold sm:text-lg">工单管理</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="shrink-0 md:hidden">
            <LogOut className="mr-2 h-4 w-4" />
            退出
          </Button>
        </header>

        {/* Scrollable main area */}
        <main className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
          {/* Stats — always at top */}
          <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-4">
            <StatCard icon={<Inbox className="h-5 w-5" />} label="总工单数" value={stats.total} />
            <StatCard icon={<Clock className="h-5 w-5" />} label="待处理" value={stats.pending} />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="已解决"
              value={stats.resolved}
            />
          </div>

          {/* Ticket list card — fills remaining space, internal scroll */}
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="flex shrink-0 flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">工单列表</CardTitle>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-52">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8 text-sm"
                    placeholder="搜索标题或邮箱..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <ListFilter className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="w-full min-w-0 sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="pending">待处理</SelectItem>
                    <SelectItem value="processing">处理中</SelectItem>
                    <SelectItem value="resolved">已解决</SelectItem>
                  </SelectContent>
                </Select>
                </div>
              </div>
            </CardHeader>

            {/* Scrollable list body */}
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {/* Mobile: card list */}
              <div className="min-h-0 space-y-3 md:hidden">
                {loading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
                ) : tickets.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">暂无工单</p>
                ) : (
                  tickets.map((t) => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      aiLoadingId={aiLoadingId}
                      onUpdateStatus={updateStatus}
                      onGenerateAI={handleGenerateAI}
                      onViewDetail={setSelected}
                    />
                  ))
                )}
              </div>

              {/* Desktop: table */}
              <div className="hidden min-h-0 overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>标题</TableHead>
                      <TableHead>联系人邮箱</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>提交时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          加载中...
                        </TableCell>
                      </TableRow>
                    ) : tickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          暂无工单
                        </TableCell>
                      </TableRow>
                    ) : (
                      tickets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="max-w-[260px] truncate font-medium">
                            {t.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{t.email}</TableCell>
                          <TableCell>
                            <TicketStatusControl ticket={t} onUpdateStatus={updateStatus} compact />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {new Date(t.created_at).toLocaleString("zh-CN")}
                          </TableCell>
                          <TableCell className="text-right">
                            <TicketActions
                              ticket={t}
                              aiLoadingId={aiLoadingId}
                              onGenerateAI={handleGenerateAI}
                              onViewDetail={setSelected}
                              layout="row"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>

            {/* Pagination footer — fixed at bottom of card */}
            {totalPages > 1 && (
              <div className="shrink-0 border-t px-4 py-3">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setPage((p) => p - 1);
                        }}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {pageNumbers[0] > 1 && (
                      <>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(1);
                            }}
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        {pageNumbers[0] > 2 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                      </>
                    )}
                    {pageNumbers.map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href="#"
                          isActive={p === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    {pageNumbers[pageNumbers.length - 1] < totalPages && (
                      <>
                        {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(totalPages);
                            }}
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < totalPages) setPage((p) => p + 1);
                        }}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </Card>
        </main>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              来自 {selected?.email} ·{" "}
              {selected && new Date(selected.created_at).toLocaleString("zh-CN")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">状态：</span>
              {selected && (
                <Badge variant={STATUS_VARIANT[selected.status]}>
                  {STATUS_LABEL[selected.status]}
                </Badge>
              )}
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">问题描述</div>
              <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                {selected?.description}
              </div>
            </div>

            {/* Existing replies */}
            {ticketReplies.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium">回复记录</div>
                <div className="space-y-3">
                  {ticketReplies.map((reply) => (
                    <div key={reply.id} className="flex gap-2.5">
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

            {/* Reply editor */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">
                  {ticketReplies.length > 0 ? "追加回复" : "回复内容"}
                </div>
                {selected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateAI(selected)}
                    disabled={aiLoadingId === selected.id}
                  >
                    {aiLoadingId === selected.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-4 w-4" />
                    )}
                    AI 生成回复
                  </Button>
                )}
              </div>
              <Textarea
                rows={4}
                placeholder="在此输入或由 AI 生成回复..."
                value={selected ? (replies[selected.id] ?? "") : ""}
                onChange={(e) =>
                  selected && setReplies((r) => ({ ...r, [selected.id]: e.target.value }))
                }
              />
              {selected && (
                <Button
                  className="mt-2 w-full"
                  onClick={() => handleSendReply(selected)}
                  disabled={
                    sendingReply && replyingTicketId === selected.id
                  }
                >
                  {sendingReply && replyingTicketId === selected.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  发送回复
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminSidebarNav({
  onLogout,
  onNavClick,
}: {
  onLogout: () => void;
  onNavClick?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold sm:h-16 sm:px-6">
        <LifeBuoy className="h-5 w-5 shrink-0 text-primary" />
        <span className="truncate">客服管理后台</span>
      </div>
      <nav className="flex-1 space-y-1 p-4" onClick={onNavClick}>
        <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          <Inbox className="h-4 w-4 shrink-0" />
          工单管理
        </div>
      </nav>
      <div className="border-t p-4">
        <Button variant="ghost" className="w-full justify-start" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </Button>
      </div>
    </div>
  );
}

function TicketStatusControl({
  ticket,
  onUpdateStatus,
  compact = false,
}: {
  ticket: Ticket;
  onUpdateStatus: (id: string, status: Ticket["status"]) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "flex items-center gap-2" : "flex flex-col gap-2 sm:flex-row sm:items-center"
      }
    >
      <Badge variant={STATUS_VARIANT[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
      <Select
        value={ticket.status}
        onValueChange={(v) => onUpdateStatus(ticket.id, v as Ticket["status"])}
      >
        <SelectTrigger className={compact ? "h-7 w-28 text-xs" : "h-9 w-full sm:w-32"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">待处理</SelectItem>
          <SelectItem value="processing">处理中</SelectItem>
          <SelectItem value="resolved">已解决</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function TicketActions({
  ticket,
  aiLoadingId,
  onGenerateAI,
  onViewDetail,
  layout,
}: {
  ticket: Ticket;
  aiLoadingId: string | null;
  onGenerateAI: (t: Ticket) => void;
  onViewDetail: (t: Ticket) => void;
  layout: "row" | "stack";
}) {
  const loading = aiLoadingId === ticket.id;
  return (
    <div
      className={layout === "row" ? "flex justify-end gap-1" : "flex flex-col gap-2 sm:flex-row"}
    >
      <Button
        variant="outline"
        size="sm"
        className={layout === "stack" ? "w-full sm:flex-1" : undefined}
        onClick={() => onGenerateAI(ticket)}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-1 h-4 w-4" />
        )}
        AI 生成回复
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={layout === "stack" ? "w-full sm:flex-1" : undefined}
        onClick={() => onViewDetail(ticket)}
      >
        <Eye className="mr-1 h-4 w-4" />
        查看详情
      </Button>
    </div>
  );
}

function TicketCard({
  ticket,
  aiLoadingId,
  onUpdateStatus,
  onGenerateAI,
  onViewDetail,
}: {
  ticket: Ticket;
  aiLoadingId: string | null;
  onUpdateStatus: (id: string, status: Ticket["status"]) => void;
  onGenerateAI: (t: Ticket) => void;
  onViewDetail: (t: Ticket) => void;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug">{ticket.title}</h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">{ticket.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(ticket.created_at).toLocaleString("zh-CN")}
          </p>
        </div>
        <TicketStatusControl ticket={ticket} onUpdateStatus={onUpdateStatus} />
        <TicketActions
          ticket={ticket}
          aiLoadingId={aiLoadingId}
          onGenerateAI={onGenerateAI}
          onViewDetail={onViewDetail}
          layout="stack"
        />
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-2.5 sm:p-6">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground sm:text-sm">{label}</div>
          <div className="mt-0.5 text-lg font-semibold leading-tight sm:mt-1 sm:text-3xl">
            {value}
          </div>
        </div>
        <div className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10 [&>svg]:h-3.5 [&>svg]:w-3.5 sm:[&>svg]:h-5 sm:[&>svg]:w-5">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
