import { cn } from "@/app/lib/cn";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

export default function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
}) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";
  const styles =
    variant === "success"
      ? "border-border bg-muted text-foreground"
      : variant === "warning"
        ? "border-dashed border-border bg-card text-foreground"
        : variant === "danger"
          ? "border-border bg-muted text-foreground"
          : variant === "info"
            ? "border-border bg-muted text-foreground"
            : "border-border bg-card text-foreground/70";

  return <span className={cn(base, styles, className)} {...props} />;
}
