"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  const initial = session?.user?.name?.[0]?.toUpperCase() ?? "U";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">O</div>
        <div>
          <div className="brand-name">Orça</div>
          <div className="brand-sub">Orçamento pessoal</div>
        </div>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="nav-group-label">{group.label}</div>
          {group.items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${active ? " active" : ""}`}
              >
                <OrcaIcon name={item.icon} size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}

      <div className="nav-spacer" />

      <div className="nav-user">
        <div className="avatar">{initial}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session?.user?.name ?? "Usuário"}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session?.user?.email}
          </div>
        </div>
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
