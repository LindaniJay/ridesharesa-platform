import { cn } from "@/app/lib/cn";

export default function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50";

  const styles =
    variant === "primary"
      ? "bg-accent text-accent-foreground shadow-sm hover:opacity-90"
      : variant === "secondary"
        ? "border border-border bg-card text-foreground shadow-sm hover:bg-muted"
        : "text-foreground/80 hover:bg-muted";

  return <button className={cn(base, styles, className)} {...props} />;
}
