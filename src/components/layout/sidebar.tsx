"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { OrcaIcon } from "@/components/ui/orca-icon";

const NAV_GROUPS = [
  {
    label: "Visão Geral",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/mes", label: "Visão do Mês", icon: "calendar" },
    ],
  },
  {
    label: "Lançamentos",
    items: [
      { href: "/creditos", label: "Créditos", icon: "arrowDown" },
      { href: "/debito", label: "Lançar Débito", icon: "arrowUp" },
    ],
  },
  {
    label: "Carteiras",
    items: [
      { href: "/bancos", label: "Bancos", icon: "wallet" },
      { href: "/investimentos", label: "Investimentos", icon: "trend" },
      { href: "/assinaturas", label: "Assinaturas", icon: "repeat" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) return stored === "1";
    return window.innerWidth < 768; // auto-collapsed no mobile
  });

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const initial = session?.user?.name?.[0]?.toUpperCase() ?? "U";

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      {/* Brand + toggle */}
      <div className="brand">
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="sidebar-toggle"
            style={{ margin: "0 auto" }}
            title="Expandir menu"
          >
            <OrcaIcon name="chevR" size={16} />
          </button>
        ) : (
          <>
            <div className="brand-mark">PF</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="brand-name">Plano Financeiro</div>
              <div className="brand-sub">Gestão financeira</div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="sidebar-toggle"
              title="Recolher menu"
            >
              <OrcaIcon name="chevL" size={15} />
            </button>
          </>
        )}
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {!collapsed && <div className="nav-group-label">{group.label}</div>}
          {collapsed && <div className="nav-group-divider" />}
          {group.items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${active ? " active" : ""}${collapsed ? " nav-item-collapsed" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <OrcaIcon name={item.icon} size={18} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="nav-spacer" />

      <div className={`nav-user${collapsed ? " nav-user-collapsed" : ""}`}>
        <div className="avatar" title={collapsed ? (session?.user?.name ?? "Usuário") : undefined}>
          {initial}
        </div>
        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session?.user?.name ?? "Usuário"}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session?.user?.email}
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "grid", placeItems: "center", padding: 4 }}
          title="Sair"
        >
          <OrcaIcon name="logout" size={17} />
        </button>
      </div>
    </aside>
  );
}
