import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  LifeBuoy, LogOut, Inbox, Clock, CheckCircle2, ListFilter, Eye,
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

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("加载工单失败：" + error.message);
      return;
    }
    setTickets((data ?? []) as Ticket[]);
  };

  useEffect(() => {
    if (authChecked) fetchTickets();
  }, [authChecked]);

  const stats = useMemo(() => ({
    total: tickets.length,
    pending: tickets.filter((t) => t.status === "pending").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  }), [tickets]);

  const filtered = useMemo(
    () => filter === "all" ? tickets : tickets.filter((t) => t.status === filter),
    [tickets, filter],
  );

  const updateStatus = async (id: string, status: Ticket["status"]) => {
    const prev = tickets;
    setTickets((ts) => ts.map((t) => t.id === id ? { ...t, status } : t));
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) {
      setTickets(prev);
      toast.error("更新失败：" + error.message);
    } else {
      toast.success("状态已更新");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6 font-semibold">
          <LifeBuoy className="h-5 w-5 text-primary" />
          客服管理后台
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            <Inbox className="h-4 w-4" />
            工单管理
          </div>
        </nav>
        <div className="border-t p-4">
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-6">
          <h1 className="text-lg font-semibold">工单管理</h1>
          <Button variant="outline" size="sm" onClick={handleLogout} className="md:hidden">
            <LogOut className="mr-2 h-4 w-4" />退出
          </Button>
        </header>

        <main className="flex-1 space-y-6 p-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={<Inbox className="h-5 w-5" />} label="总工单数" value={stats.total} />
            <StatCard icon={<Clock className="h-5 w-5" />} label="待处理" value={stats.pending} />
            <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="已解决" value={stats.resolved} />
          </div>

          {/* Filter */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">工单列表</CardTitle>
              <div className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-muted-foreground" />
                <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="pending">待处理</SelectItem>
                    <SelectItem value="processing">处理中</SelectItem>
                    <SelectItem value="resolved">已解决</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                      <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">加载中...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">暂无工单</TableCell></TableRow>
                    ) : filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="max-w-[260px] truncate font-medium">{t.title}</TableCell>
                        <TableCell className="text-muted-foreground">{t.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                            <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v as Ticket["status"])}>
                              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">待处理</SelectItem>
                                <SelectItem value="processing">处理中</SelectItem>
                                <SelectItem value="resolved">已解决</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Date(t.created_at).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(t)}>
                            <Eye className="mr-1 h-4 w-4" />查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              来自 {selected?.email} · {selected && new Date(selected.created_at).toLocaleString("zh-CN")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">状态：</span>
              {selected && <Badge variant={STATUS_VARIANT[selected.status]}>{STATUS_LABEL[selected.status]}</Badge>}
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">问题描述</div>
              <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                {selected?.description}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-semibold">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
