import { cn } from "@/app/lib/cn";

export default function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-shadow placeholder:text-foreground/40 focus-visible:ring-2 focus-visible:ring-accent/30",
        className,
      )}
      {...props}
    />
  );
}
