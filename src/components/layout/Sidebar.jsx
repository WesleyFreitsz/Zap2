import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Settings,
  BarChart3,
  Smartphone,
  Zap,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarClock,
  Users,
  Package,
  Target,
  CreditCard,
  ShieldCheck,
  Building2,
  Receipt,
  Crown,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";

// ── SUPER_ADMIN navigation with submenus ──
const superAdminNav = [
  {
    label: "Painel",
    icon: ShieldCheck,
    path: "/admin-dashboard",
  },
  {
    label: "Empresas",
    icon: Building2,
    submenu: true,
    children: [
      { label: "Listar Empresas", path: "/admin-dashboard", icon: Building2 },
    ],
  },
  {
    label: "Planos",
    icon: Crown,
    path: "/admin/plans",
  },
  {
    label: "Faturamento",
    icon: Receipt,
    submenu: true,
    children: [
      { label: "Visão Geral", path: "/admin/billing", icon: CreditCard },
    ],
  },
  {
    label: "Configurações",
    icon: Settings,
    path: "/settings",
  },
];

// ── Client company navigation (ADMIN / EMPLOYEE / TEAM_LEADER) ──
const clientNav = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/dashboard",
    roles: ["ADMIN"],
  },
  {
    icon: MessageSquare,
    label: "Conversas",
    path: "/conversations",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    icon: Target,
    label: "Leads",
    path: "/leads",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    icon: BarChart3,
    label: "Analytics",
    path: "/analytics",
    roles: ["ADMIN", "TEAM_LEADER"],
  },
  {
    icon: CalendarClock,
    label: "Agenda",
    path: "/schedule",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  {
    icon: Package,
    label: "Produtos",
    path: "/products",
    roles: ["ADMIN", "EMPLOYEE"],
  },
  { icon: Bot, label: "Config IA", path: "/ai-config", roles: ["ADMIN"] },
  { icon: Smartphone, label: "WhatsApp", path: "/whatsapp", roles: ["ADMIN"] },
  { icon: Users, label: "Funcionários", path: "/employees", roles: ["ADMIN"] },
  {
    icon: CreditCard,
    label: "Faturamento",
    path: "/billing",
    roles: ["ADMIN"],
  },
  {
    icon: Settings,
    label: "Configurações",
    path: "/settings",
    roles: ["ADMIN", "EMPLOYEE"],
  },
];

function getUserEffectiveRole(user) {
  if (!user) return null;
  if (user.role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (user.role === "ADMIN") return "ADMIN";
  if (user.isTeamLeader) return "TEAM_LEADER";
  return "EMPLOYEE";
}

function NavItem({ item, collapsed, isActive }) {
  return (
    <Link to={item.path}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}
      </div>
    </Link>
  );
}

function SubmenuItem({ item, collapsed, location }) {
  const [open, setOpen] = useState(false);
  const isChildActive = item.children?.some(
    (c) => location.pathname === c.path,
  );

  if (collapsed) {
    return item.children?.map((child) => (
      <NavItem
        key={child.path}
        item={child}
        collapsed={collapsed}
        isActive={location.pathname === child.path}
      />
    ));
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
          isChildActive
            ? "text-sidebar-foreground font-semibold"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        <span className="text-sm font-medium truncate flex-1 text-left">
          {item.label}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="ml-4 pl-3 border-l border-sidebar-border/40 space-y-0.5 mt-0.5">
          {item.children.map((child) => (
            <Link key={child.path} to={child.path}>
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-all",
                  location.pathname === child.path
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <child.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{child.label}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { branding } = useTheme();

  const effectiveRole = getUserEffectiveRole(user);
  const isSuperAdmin = effectiveRole === "SUPER_ADMIN";

  const navItems = isSuperAdmin
    ? superAdminNav
    : clientNav.filter((item) => {
      if (!item.roles) return true;
      if (item.roles.includes(effectiveRole)) return true;
      if (effectiveRole === "TEAM_LEADER" && item.roles.includes("EMPLOYEE"))
        return true;
      return false;
    });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col z-50 transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt="Logo"
            className="w-8 h-8 rounded-lg object-contain shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">
            {branding.platformName || "Zap2"}
          </span>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
              isSuperAdmin
                ? "bg-amber-500/20 text-amber-400"
                : effectiveRole === "ADMIN"
                  ? "bg-blue-500/20 text-blue-400"
                  : effectiveRole === "TEAM_LEADER"
                    ? "bg-purple-500/20 text-purple-400"
                    : "bg-slate-500/20 text-slate-400",
            )}
          >
            {isSuperAdmin
              ? "Super Admin"
              : effectiveRole === "ADMIN"
                ? "Admin"
                : effectiveRole === "TEAM_LEADER"
                  ? "Líder"
                  : "Funcionário"}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item, idx) =>
          item.submenu ? (
            <SubmenuItem
              key={idx}
              item={item}
              collapsed={collapsed}
              location={location}
            />
          ) : (
            <NavItem
              key={item.path}
              item={item}
              collapsed={collapsed}
              isActive={location.pathname === item.path}
            />
          ),
        )}
      </nav>

      {/* User info + Bottom */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              {user.name}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">
              {user.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className={cn(
            "w-full text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent",
            collapsed ? "justify-center" : "justify-start gap-3 px-3",
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
