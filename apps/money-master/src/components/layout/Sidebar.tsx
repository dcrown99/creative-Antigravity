"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui";
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Settings,
  FileText,
  DollarSign,
  Upload,

} from "lucide-react";
import { ModeToggle } from "@repo/ui";

const routes = [
  {
    label: "ダッシュボード",
    icon: LayoutDashboard,
    href: "/",
  },

  {
    label: "資産一覧",
    icon: Wallet,
    href: "/assets",
  },
  {
    label: "取引明細",
    icon: FileText,
    href: "/transactions",
  },
  {
    label: "配当管理",
    icon: DollarSign,
    href: "/dividends",
  },
  {
    label: "分析レポート",
    icon: TrendingUp,
    href: "/analytics",
  },
  {
    label: "データ取込",
    icon: Upload,
    href: "/import",
  },
  {
    label: "設定",
    icon: Settings,
    href: "/settings",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-background border-r w-64 hidden md:flex shrink-0">
      <div className="px-3 py-2 flex-1">
        <Link href="/" className="flex items-center pl-3 mb-14">
          <h1 className="text-2xl font-bold">Money Master</h1>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              prefetch={true}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer rounded-lg transition-colors duration-200",
                pathname === route.href
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-muted-foreground hover:text-primary hover:bg-accent"
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className="h-5 w-5 mr-3" />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="px-3 py-2 border-t">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">テーマ切り替え</span>
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
