import { cn } from "@/app/lib/cn";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

export default function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
}) {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
  const styles =
    variant === "success"
      ? "border-foreground/20 bg-foreground/5 text-foreground"
      : variant === "warning"
        ? "border-dashed border-foreground/30 bg-transparent text-foreground"
        : variant === "danger"
          ? "border-foreground/30 bg-foreground/10 text-foreground"
          : variant === "info"
            ? "border-foreground/10 bg-foreground/5 text-foreground"
            : "border-foreground/10 bg-transparent text-foreground/70";

  return <span className={cn(base, styles, className)} {...props} />;
}
