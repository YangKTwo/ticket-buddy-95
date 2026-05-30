import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy } from "lucide-react";
import { ChatWidget } from "@/components/ChatWidget";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "提交工单 — 客服支持" },
      { name: "description", content: "提交您的问题，我们的客服团队会尽快为您处理。" },
    ],
  }),
  component: SubmitTicketPage,
});

const ticketSchema = z.object({
  title: z.string().trim().min(1, "请填写标题").max(120, "标题不能超过 120 字"),
  description: z.string().trim().min(1, "请描述您的问题").max(2000, "描述不能超过 2000 字"),
  email: z.string().trim().email("请输入有效的邮箱").max(255),
});

function SubmitTicketPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ticketSchema.safeParse({ title, description, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "表单填写有误");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("tickets").insert(parsed.data);
    setSubmitting(false);
    if (error) {
      toast.error("提交失败：" + error.message);
      return;
    }
    toast.success("提交成功，我们会尽快处理");
    setTitle("");
    setDescription("");
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="h-5 w-5 text-primary" />
            客服支持中心
          </div>
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            管理员登录
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">提交工单</CardTitle>
            <CardDescription>
              请详细描述您遇到的问题，我们会通过邮箱与您联系。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">标题 <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="一句话概括您的问题"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">问题描述 <span className="text-destructive">*</span></Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请描述问题的具体情况、复现步骤等"
                  rows={6}
                  maxLength={2000}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">联系人邮箱 <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={255}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "提交中..." : "提交工单"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
