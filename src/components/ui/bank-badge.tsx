import { BANKS, BankKey } from "@/lib/constants";

interface BankBadgeProps {
  id: BankKey;
  size?: number;
}

export function BankBadge({ id, size = 38 }: BankBadgeProps) {
  const b = BANKS[id];
  return (
    <div
      className="bank-badge"
      style={{
        background: b.color,
        color: b.on,
        width: size,
        height: size,
        borderRadius: size * 0.29,
        fontSize: size * 0.37,
      }}
    >
      {b.short}
    </div>
  );
}
