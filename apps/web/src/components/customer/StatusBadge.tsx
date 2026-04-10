import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  label: string;
  tone: "neutral" | "positive" | "warning" | "critical" | "technical";
  className?: string;
};

export function StatusBadge({
  label,
  tone,
  className
}: StatusBadgeProps) {
  return (
    <span
      aria-label={`Status: ${label}`}
      className={cn("stb-status-badge", className)}
      data-tone={tone}
      role="status"
    >
      {label}
    </span>
  );
}
