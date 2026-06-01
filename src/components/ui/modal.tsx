"use client";

import { useEffect } from "react";
import { OrcaIcon } from "./orca-icon";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, width = 520 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(27,27,22,.45)", backdropFilter: "blur(2px)" }} />
      <div
        style={{ position: "relative", background: "var(--surface)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", width, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 64px)", overflow: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "grid", placeItems: "center", padding: 4, borderRadius: "var(--r-sm)" }}>
            <OrcaIcon name="dots" size={20} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}
