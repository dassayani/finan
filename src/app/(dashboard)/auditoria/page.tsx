"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { formatBRL } from "@/lib/constants";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

interface ApiResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

const ENTITY_LABEL: Record<string, string> = {
  credit: "Receita",
  transaction: "Despesa",
  investment: "Investimento",
  subscription: "Assinatura",
  reconciliation: "Reconciliação",
};

const ENTITY_ICON: Record<string, string> = {
  credit: "arrowDown",
  transaction: "arrowUp",
  investment: "trend",
  subscription: "repeat",
  reconciliation: "check",
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Criado",
  UPDATE: "Atualizado",
  DELETE: "Excluído",
  PAY: "Pago",
  UNPAY: "Estornado",
  RECONCILE_ALERT: "Alerta",
};

const ACTION_COLOR: Record<string, { bg: string; fg: string; dot: string }> = {
  CREATE:          { bg: "var(--pos-soft)",  fg: "var(--pos)",  dot: "var(--pos)"  },
  UPDATE:          { bg: "var(--warn-soft)", fg: "var(--warn)", dot: "var(--warn)" },
  DELETE:          { bg: "var(--neg-soft)",  fg: "var(--neg)",  dot: "var(--neg)"  },
  PAY:             { bg: "var(--pos-soft)",  fg: "var(--pos)",  dot: "var(--pos)"  },
  UNPAY:           { bg: "var(--neg-soft)",  fg: "var(--neg)",  dot: "var(--neg)"  },
  RECONCILE_ALERT: { bg: "var(--warn-soft)", fg: "var(--warn)", dot: "var(--warn)" },
};

const ALL_ENTITIES = Object.keys(ENTITY_LABEL);
const ALL_ACTIONS  = Object.keys(ACTION_LABEL);

function ac(action: string) {
  return ACTION_COLOR[action] ?? { bg: "var(--surface-3)", fg: "var(--ink-2)", dot: "var(--ink-3)" };
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function summarize(log: AuditLog): string {
  const data = log.after ?? log.before;
  if (!data || typeof data !== "object") return (log.entityId ?? "");
  const parts: string[] = [];
  if (typeof data.description === "string") parts.push(data.description);
  if (typeof data.name       === "string") parts.push(data.name);
  if (data.amount != null) parts.push(formatBRL(Number(data.amount)));
  if (data.total  != null) parts.push(formatBRL(Number(data.total)));
  if (data.value  != null) parts.push(formatBRL(Number(data.value)));
  return parts.slice(0, 2).join(" · ") || (log.entityId ?? "");
}

function renderVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return formatBRL(v);
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "string" && v.length > 60) return v.slice(0, 60) + "…";
  return String(v);
}

function DiffBlock({ before, after }: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  if (!keys.length) return null;
  const hasBoth = !!(before && after);

  return (
    <div style={{ marginTop: 12, borderRadius: "var(--r-sm)", overflow: "hidden", border: "1px solid var(--line)" }}>
      {hasBoth && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          background: "var(--surface-3)", padding: "6px 14px",
          borderBottom: "1px solid var(--line)",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".07em" }}>Campo</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".07em" }}>Antes</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".07em" }}>Depois</span>
        </div>
      )}
      {keys.map((k, i) => {
        const bv = before?.[k];
        const av = after?.[k];
        const changed = hasBoth && JSON.stringify(bv) !== JSON.stringify(av);
        return (
          <div key={k} style={{
            display: "grid",
            gridTemplateColumns: hasBoth ? "1fr 1fr 1fr" : "1fr 2fr",
            gap: "0 12px",
            padding: "8px 14px",
            background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
            borderBottom: i < keys.length - 1 ? "1px solid var(--line-2)" : undefined,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>{k}</span>
            {before && (
              <span className="num" style={{
                fontSize: 12,
                color: changed ? "var(--neg)" : "var(--ink-2)",
                textDecoration: changed ? "line-through" : undefined,
              }}>{renderVal(bv)}</span>
            )}
            {after && (
              <span className="num" style={{
                fontSize: 12,
                color: changed ? "var(--pos)" : "var(--ink-2)",
                fontWeight: changed ? 700 : undefined,
              }}>{renderVal(av)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditoriaPage() {
  const [data, setData]               = useState<ApiResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);
  const [filterEntity, setFilterEntity] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    if (filterEntity) p.set("entity", filterEntity);
    if (filterAction) p.set("action", filterAction);
    const res = await fetch(`/api/audit-logs?${p}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [page, filterEntity, filterAction]);

  useEffect(() => { void load(); }, [load]);

  function setEntity(val: string | null) { setFilterEntity(val); setPage(1); setExpanded(null); }
  function setAction(val: string | null) { setFilterAction(val); setPage(1); setExpanded(null); }

  return (
    <>
      {/* ── Topbar ─────────────────────────────────────────── */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Sistema</div>
          <div className="page-title">Auditoria</div>
        </div>
        <div className="topbar-r">
          {data && (
            <span className="chip">
              <OrcaIcon name="book" size={13} />
              {data.total} {data.total === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="content">

        {/* Filtros */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Filtro por tipo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="section-label" style={{ minWidth: 52 }}>Tipo</span>
              <button
                className={`chip${filterEntity === null ? " active" : ""}`}
                style={{ cursor: "pointer", border: "none", background: filterEntity === null ? "var(--accent-soft)" : undefined, color: filterEntity === null ? "var(--accent)" : undefined }}
                onClick={() => setEntity(null)}
              >Todos</button>
              {ALL_ENTITIES.map(e => (
                <button key={e} className="chip"
                  style={{ cursor: "pointer", border: "none", background: filterEntity === e ? "var(--accent-soft)" : undefined, color: filterEntity === e ? "var(--accent)" : undefined }}
                  onClick={() => setEntity(filterEntity === e ? null : e)}
                >
                  <OrcaIcon name={ENTITY_ICON[e] ?? "calendar"} size={12} />
                  {ENTITY_LABEL[e]}
                </button>
              ))}
            </div>

            <div style={{ height: 1, background: "var(--line-2)" }} />

            {/* Filtro por ação */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="section-label" style={{ minWidth: 52 }}>Ação</span>
              <button
                className="chip"
                style={{ cursor: "pointer", border: "none", background: filterAction === null ? "var(--accent-soft)" : undefined, color: filterAction === null ? "var(--accent)" : undefined }}
                onClick={() => setAction(null)}
              >Todas</button>
              {ALL_ACTIONS.map(a => {
                const c = ac(a);
                const active = filterAction === a;
                return (
                  <button key={a} className="chip"
                    style={{ cursor: "pointer", border: "none", background: active ? c.bg : undefined, color: active ? c.fg : undefined }}
                    onClick={() => setAction(filterAction === a ? null : a)}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, display: "inline-block", flexShrink: 0 }} />
                    {ACTION_LABEL[a]}
                  </button>
                );
              })}
            </div>

          </div>
        </div>

        {/* Lista */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Histórico de eventos</div>
            {data && data.totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}
                  disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <OrcaIcon name="chevL" size={13} />Anterior
                </button>
                <span className="muted num" style={{ fontSize: 12, minWidth: 80, textAlign: "center" }}>
                  {page} / {data.totalPages}
                </span>
                <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}
                  disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                  Próxima<OrcaIcon name="chevR" size={13} />
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ display: "grid", placeItems: "center", padding: 80 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : !data?.logs.length ? (
            <div className="card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 60 }}>
              <OrcaIcon name="book" size={32} style={{ margin: "0 auto 12px", opacity: 0.25 }} />
              <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>Nenhum registro encontrado</p>
              {(filterEntity || filterAction) && (
                <button className="btn btn-ghost" style={{ marginTop: 12 }}
                  onClick={() => { setEntity(null); setAction(null); }}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            data.logs.map((log, i) => {
              const c = ac(log.action);
              const isExpanded = expanded === log.id;
              const hasDiff = !!(log.before ?? log.after);
              const icon = ENTITY_ICON[log.entity] ?? "calendar";

              return (
                <div key={log.id} style={{ borderBottom: i < data.logs.length - 1 ? "1px solid var(--line-2)" : undefined }}>
                  <div
                    className="row"
                    style={{ padding: "12px 20px", cursor: hasDiff ? "pointer" : "default", background: isExpanded ? "var(--surface-2)" : undefined }}
                    onClick={() => hasDiff && setExpanded(isExpanded ? null : log.id)}
                  >
                    {/* Ícone da entidade com dot colorido */}
                    <div className="row-l">
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: "var(--surface-3)",
                          display: "grid", placeItems: "center",
                        }}>
                          <OrcaIcon name={icon} size={17} style={{ color: "var(--ink-2)" }} />
                        </div>
                        <span style={{
                          position: "absolute", bottom: -2, right: -2,
                          width: 10, height: 10, borderRadius: "50%",
                          background: c.dot, border: "2px solid var(--surface)",
                        }} />
                      </div>
                      <div>
                        <div className="row-name">{summarize(log) || (ENTITY_LABEL[log.entity] ?? log.entity)}</div>
                        <div className="row-meta">
                          {ENTITY_LABEL[log.entity] ?? log.entity}
                          {log.ip && <span style={{ marginLeft: 8 }}>· IP {log.ip}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Lado direito */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                        background: c.bg, color: c.fg,
                      }}>{ACTION_LABEL[log.action] ?? log.action}</span>
                      <span className="muted num" style={{ fontSize: 12, minWidth: 110, textAlign: "right" }}>
                        {formatDateTime(log.createdAt)}
                      </span>
                      {hasDiff && (
                        <OrcaIcon
                          name={isExpanded ? "chevL" : "chevR"}
                          size={14}
                          style={{ color: "var(--ink-3)", transform: isExpanded ? "rotate(-90deg)" : "rotate(90deg)" }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Diff expandido */}
                  {isExpanded && hasDiff && (
                    <div style={{ padding: "0 20px 16px", background: "var(--surface-2)" }}>
                      {log.before && log.after ? (
                        <DiffBlock before={log.before} after={log.after} />
                      ) : log.before ? (
                        <>
                          <div className="section-label" style={{ marginBottom: 8 }}>Estado removido</div>
                          <DiffBlock before={log.before} after={null} />
                        </>
                      ) : (
                        <>
                          <div className="section-label" style={{ marginBottom: 8 }}>Estado criado</div>
                          <DiffBlock before={null} after={log.after} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
