import { cn } from "@/app/lib/cn";

export default function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

  const styles =
    variant === "primary"
      ? "bg-accent text-accent-foreground shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_18px_-10px_rgba(0,0,0,0.45)] hover:brightness-[1.04]"
      : variant === "secondary"
        ? "border border-border bg-card text-foreground shadow-sm hover:bg-muted/80"
        : "text-foreground/80 hover:bg-muted";

  return <button className={cn(base, styles, className)} {...props} />;
}
