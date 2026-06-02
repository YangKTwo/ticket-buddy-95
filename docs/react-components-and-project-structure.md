# React 组件写法与项目结构指南

> 基于 Ticket Buddy 项目实际代码的解析笔记。

---

## 一、一个文件中为什么可以有多个 function、多个 return

### 1.1 核心概念：文件 ≠ 组件

在 React 中：

```
一个文件 = 1 个主组件 + N 个子组件 + N 个工具函数 + N 个自定义 Hook
```

以 `src/routes/admin.tsx`（539 行）为例，一个文件里有 **7 个函数**，但只有 **1 个是路由入口**：

| 函数名 | 类型 | 作用 | 如何被调用 |
|--------|------|------|-----------|
| `AdminPage` | 主组件 | 管理后台整个页面 | `<Route component={AdminPage}>` |
| `AdminSidebarNav` | 子组件 | 侧边栏导航 | `<AdminSidebarNav />` |
| `TicketStatusControl` | 子组件 | 状态下拉选择框 | `<TicketStatusControl />` |
| `TicketActions` | 子组件 | 操作按钮组 | `<TicketActions />` |
| `TicketCard` | 子组件 | 移动端工单卡片 | `<TicketCard />` |
| `StatCard` | 子组件 | 统计数字卡片 | `<StatCard />` |
| `updateStatus` | 普通函数 | 更新工单状态的业务逻辑 | `updateStatus(id, status)` |

### 1.2 三种 function 的区别

| | 组件函数 | 普通函数 | 自定义 Hook |
|---|---|---|---|
| **返回什么** | JSX（`<div>...</div>`） | 普通值（字符串、数字、对象等）或 void | 普通值（boolean、对象等） |
| **怎么调用** | `<Foo />` 标签语法 | `foo()` 括号语法 | `useFoo()` 在组件内调用 |
| **能用 React Hooks 吗** | ✅ `useState`, `useEffect` 等 | ❌ 不行 | ✅ 可以 |
| **命名规则** | 大驼峰（PascalCase） | 小驼峰（camelCase） | `use` 开头 + 大驼峰 |

#### 组件函数示例

```tsx
// 返回 JSX，首字母大写，用 <StatCard /> 调用
function StatCard({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

// 调用方式：
<StatCard icon={<Inbox />} label="总工单数" value={stats.total} />
```

#### 普通函数示例

```tsx
// 不返回 JSX，只执行业务逻辑，用 updateStatus(id, status) 调用
const updateStatus = async (id: string, status: Ticket["status"]) => {
  const prev = tickets;
  // 乐观更新：先更新 UI
  setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
  // 再请求后端
  const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
  if (error) {
    setTickets(prev);  // 失败则回滚
    toast.error("更新失败：" + error.message);
  }
};

// 调用方式：
updateStatus(ticket.id, "resolved");
```

#### 自定义 Hook 示例（`src/hooks/use-mobile.tsx`）

```tsx
// Hook：函数名以 use 开头，内部可以用 React hooks，返回普通值
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: 767px)`);
    const onChange = () => setIsMobile(window.innerWidth < 768);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < 768);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;  // 返回 boolean，不是 JSX
}

// 调用方式（在组件内部）：
function AdminPage() {
  const isMobile = useIsMobile();  // 直接在组件里调用，拿到 boolean 值
}
```

### 1.3 为什么放在同一个文件？（Co-location 模式）

这些子组件**只被 `AdminPage` 使用**，不往外暴露（没有 `export`）：

- ✅ 相关的东西放在一起，方便阅读和维护
- ✅ 避免为 20 行的组件单独建文件，减少文件跳转
- ✅ 共享同一份类型定义和常量（如 `STATUS_LABEL`、`STATUS_VARIANT`）

---

## 二、正常企业项目是怎么写的？

### 2.1 Lovable 生成 vs 企业项目的区别

| | Lovable 生成（本项目的风格） | 正常企业项目 |
|---|---|---|
| **组件拆分** | 6 个组件挤在 1 个文件 | 每个独立文件，按功能分文件夹 |
| **单文件行数** | 539 行（admin.tsx） | 通常不超过 200 行 |
| **类型定义** | 混在组件文件里（`type Ticket = {...}`） | 抽到 `types.ts` |
| **API 调用** | 直接在组件里写 `supabase.from()` | 抽到 `services/` 或 `hooks/` |
| **常量** | 写在组件文件顶部 | 抽到 `constants.ts` |
| **UI 基础组件** | copy-paste 到 `components/ui/` | npm 包 `@shadcn/ui` 或独立组件库 |

### 2.2 企业级目录结构参考

把你的项目按职责拆分后，应该是这样：

```
src/
├── features/
│   └── admin/
│       ├── components/
│       │   ├── AdminSidebar.tsx          # 侧边栏
│       │   ├── TicketTable.tsx           # 桌面端表格
│       │   ├── TicketCard.tsx            # 移动端卡片
│       │   ├── TicketStatusControl.tsx   # 状态下拉框
│       │   ├── TicketActions.tsx         # 操作按钮组
│       │   ├── StatCard.tsx              # 统计卡片
│       │   └── TicketDetailDialog.tsx    # 工单详情弹窗
│       ├── hooks/
│       │   └── useTickets.ts             # 工单数据获取逻辑
│       ├── types.ts                      # Ticket 等类型定义
│       └── constants.ts                  # STATUS_LABEL, STATUS_VARIANT 常量
├── services/
│   └── aiService.ts                      # AI 服务（通义千问）
├── integrations/
│   └── supabase/
│       ├── client.ts                     # 前端 Supabase 客户端
│       ├── client.server.ts              # 服务端 Supabase 客户端
│       ├── auth-middleware.ts            # 认证中间件
│       ├── auth-attacher.ts             # 客户端认证附加器
│       └── types.ts                      # 数据库类型定义（自动生成）
├── components/
│   └── ui/                               # 46 个 shadcn/ui 基础组件
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
├── hooks/
│   └── use-mobile.tsx                    # 移动端检测 Hook
├── lib/
│   ├── utils.ts                          # cn() 工具函数
│   ├── config.server.ts                  # 服务端配置
│   ├── error-capture.ts                  # 错误捕获
│   ├── error-page.ts                     # 错误页面渲染
│   └── lovable-error-reporting.ts        # 错误上报
├── routes/
│   ├── __root.tsx                        # 根路由（布局壳）
│   ├── index.tsx                         # 用户提交工单页
│   ├── login.tsx                         # 管理员登录页
│   └── admin.tsx                         # 管理后台路由入口
├── styles.css                            # 全局样式 & 设计系统
├── router.tsx                            # 路由实例
├── server.ts                             # SSR 服务器入口
├── start.ts                              # 应用启动入口
└── routeTree.gen.ts                      # 自动生成的路由树
```

### 2.3 拆分原则

| 场景 | 做法 | 理由 |
|------|------|------|
| 子组件 ≥50 行 | 独立文件 | 可读性 |
| 子组件被多个文件引用 | 独立文件 + `export` | 复用 |
| 子组件 <20 行且只在一处用 | 可以放同文件 | 避免过度拆分 |
| 类型/接口/常量被多处引用 | 独立 `types.ts` / `constants.ts` | 单一数据源 |
| API/数据逻辑超过 10 行 | 抽到 `hooks/useXxx.ts` | 关注点分离 |

### 2.4 总结

- **本项目的写法**（AI 生成风格）更适合**原型/Demo/个人小项目**，快速出活
- **企业项目**会拆得更细，每个文件 50-150 行，单人维护还是团队协作都更友好
- **本质上的代码逻辑不变**，只是文件的粒度不同
- 项目规模越大、协作人数越多，就越需要拆分
