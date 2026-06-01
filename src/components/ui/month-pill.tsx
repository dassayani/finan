"use client";

import { OrcaIcon } from "./orca-icon";

interface MonthPillProps {
  label: string;
  onPrev?: () => void;
  onNext?: () => void;
}

export function MonthPill({ label, onPrev, onNext }: MonthPillProps) {
  return (
    <div className="month-pill">
      <button className="arw" onClick={onPrev} type="button">
        <OrcaIcon name="chevL" size={15} />
      </button>
      <span className="num">{label}</span>
      <button className="arw" onClick={onNext} type="button">
        <OrcaIcon name="chevR" size={15} />
      </button>
    </div>
  );
}
