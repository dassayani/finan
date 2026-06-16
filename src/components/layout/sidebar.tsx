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
      { href: "/auditoria", label: "Auditoria", icon: "book" },
    ],
  },
  {
    label: "Lançamentos",
    items: [
      { href: "/creditos", label: "Receitas", icon: "arrowDown" },
      { href: "/debito", label: "Despesas", icon: "arrowUp" },
      { href: "/assinaturas", label: "Assinaturas", icon: "repeat" },
    ],
  },
  {
    label: "Carteiras",
    items: [
      { href: "/bancos", label: "Bancos", icon: "wallet" },
      { href: "/investimentos", label: "Investimentos", icon: "trend" },
      { href: "/emprestimos", label: "Empréstimos", icon: "coins" },
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
            <div className="brand-mark">
              <svg width="20" height="20" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="26" width="52" height="34" rx="7" fill="none" stroke="white" strokeWidth="5" strokeOpacity=".95" />
                <line x1="10" y1="40" x2="62" y2="40" stroke="white" strokeWidth="5" strokeOpacity=".95" />
                <circle cx="57" cy="21" r="10" fill="#0A2E18" />
                <line x1="57" y1="15" x2="57" y2="27" stroke="white" strokeWidth="4" strokeLinecap="round" />
                <line x1="51" y1="21" x2="63" y2="21" stroke="white" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="brand-name">SmartWallet<sup style={{ fontSize: "10px", opacity: .75 }}>+</sup></div>
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
