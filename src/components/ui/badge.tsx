import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
}

function Badge({ className, color, style, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", className)}
      style={{ backgroundColor: color ? `${color}20` : undefined, color: color, ...style }}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
