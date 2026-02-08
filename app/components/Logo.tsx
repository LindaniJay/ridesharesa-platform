import Link from "next/link";
import Image from "next/image";

export default function Logo({
  href = "/",
  variant = "full",
}: {
  href?: string;
  variant?: "full" | "mark";
}) {
  return (
    <Link href={href} className="group inline-flex items-center gap-3">
      <span className="h-12 w-12 overflow-hidden rounded-full bg-card/70 shadow-lg ring-1 ring-border transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
        <Image
          src="/rideshare-logo.png"
          alt="RideShare SA logo"
          width={48}
          height={48}
          className="h-full w-full object-cover"
          priority
        />
      </span>

      {variant === "full" ? (
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-bold tracking-tight">RideShare SA</span>
          <span className="text-xs text-foreground/60">Peer-to-peer car rentals</span>
        </span>
      ) : null}
    </Link>
  );
}
