"use client";

interface BatchFeedbackContentProps {
  summary: string;
  failures: string[];
  tone: "warn" | "error";
  onClose: () => void;
}

export function BatchFeedbackContent({ summary, failures, tone, onClose }: BatchFeedbackContentProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: tone === "error" ? "var(--neg)" : "var(--warn)",
        background: tone === "error" ? "var(--neg-soft)" : "var(--warn-soft)",
        border: `1px solid ${tone === "error" ? "var(--neg)" : "var(--warn)"}`,
        borderRadius: "var(--r-sm)",
        padding: "10px 12px",
      }}>
        {summary}
      </div>

      {failures.length > 0 && (
        <div style={{
          maxHeight: 240,
          overflowY: "auto",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-sm)",
          padding: "8px 10px",
          background: "var(--surface-2)",
        }}>
          {failures.map((failure, idx) => (
            <div
              key={`${idx}-${failure}`}
              style={{
                fontSize: 12.5,
                color: "var(--ink-2)",
                padding: "5px 0",
                borderBottom: idx < failures.length - 1 ? "1px solid var(--line-2)" : "none",
              }}
            >
              {failure}
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-primary" onClick={onClose} style={{ justifyContent: "center" }}>
        Entendi
      </button>
    </div>
  );
}
