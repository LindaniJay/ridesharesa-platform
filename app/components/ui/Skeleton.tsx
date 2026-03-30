import { cn } from "@/app/lib/cn";

export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/70", className)} aria-hidden="true" />;
}
