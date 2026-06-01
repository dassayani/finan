"use client";

import { OrcaIcon } from "./orca-icon";

interface PayToggleProps {
  paid: boolean;
  onToggle?: () => void;
  label?: { paid?: string; pending?: string };
}

export function PayToggle({ paid, onToggle, label }: PayToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`pay-toggle${paid ? " is-paid" : ""}`}
    >
      <span className="pt-check">
        {paid && <OrcaIcon name="check" size={11} />}
      </span>
      {paid ? (label?.paid ?? "Pago") : (label?.pending ?? "Pendente")}
    </button>
  );
}
