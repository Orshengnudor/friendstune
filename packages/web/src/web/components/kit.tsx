import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "../lib/utils";
import type { Collection } from "../lib/chain";

export function Panel({
  title,
  right,
  children,
  className,
  bodyClass,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <span className="micro">{title}</span>
          {right}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  disabled,
  className,
  title,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "warm" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: "button" | "submit";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-teal/12 text-teal border-teal/45 hover:bg-teal/20 hover:border-teal/70 disabled:hover:bg-teal/12",
    warm:
      "bg-orange/12 text-orange border-orange/45 hover:bg-orange/20 hover:border-orange/70",
    ghost: "bg-panel-2 text-ink-dim border-line hover:text-ink hover:border-ink-dim/50",
    danger: "bg-panel-2 text-ink-dim border-line hover:text-orange hover:border-orange/50",
  };
  const sizes: Record<string, string> = {
    sm: "h-7 px-2.5 text-[10px]",
    md: "h-9 px-3.5 text-[11px]",
    lg: "h-11 px-5 text-xs",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press inline-flex shrink-0 items-center justify-center gap-2 rounded-[4px] border font-mono font-medium tracking-[0.1em] uppercase disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tag({
  children,
  tone = "dim",
  className,
}: {
  children: ReactNode;
  tone?: "dim" | "teal" | "orange" | "violet" | "amber";
  className?: string;
}) {
  const tones: Record<string, string> = {
    dim: "border-line bg-panel-2 text-ink-dim",
    teal: "border-teal/40 bg-teal/10 text-teal",
    orange: "border-orange/40 bg-orange/10 text-orange",
    violet: "border-violet/40 bg-violet/10 text-violet",
    amber: "border-amber/40 bg-amber/10 text-amber",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] whitespace-nowrap uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "teal" | "orange" | "amber" | "violet";
}) {
  const colors: Record<string, string> = {
    teal: "text-teal",
    orange: "text-orange",
    amber: "text-amber",
    violet: "text-violet",
  };
  return (
    <div className="min-w-0">
      <div className="micro truncate">{label}</div>
      <div className={cn("data mt-1 truncate text-base text-ink", tone && colors[tone])}>
        {value}
      </div>
      {sub && <div className="data mt-0.5 truncate text-[10px] text-ink-dim">{sub}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 justify-center">
      <span className="ft-spin block size-4 rounded-full border-2 border-teal/25 border-t-teal" />
      {label && <span className="micro">{label}</span>}
    </div>
  );
}

export function Empty({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="font-display text-lg text-ink">{title}</div>
      {detail && <p className="max-w-md text-sm text-ink-dim">{detail}</p>}
      {action}
    </div>
  );
}

/** Artwork straight from chain, a data-URI SVG of an 8×8 / 16×16 bitmap. */
export function PixelArt({
  src,
  alt,
  className,
  tone,
}: {
  src: string;
  alt: string;
  className?: string;
  tone?: Collection;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[3px] border",
        tone === "genesis" ? "border-orange/25" : "border-line",
        className,
      )}
    >
      <img src={src} alt={alt} className="pixelated size-full object-cover" loading="lazy" />
    </div>
  );
}

export function FriendLink({
  collection,
  tokenId,
  children,
  className,
}: {
  collection: Collection;
  tokenId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={`/f/${collection}/${tokenId}`} className={className}>
      {children}
    </Link>
  );
}

export function SimBadge({ className }: { className?: string }) {
  return (
    <Tag tone="amber" className={className}>
      simulated
    </Tag>
  );
}

export function Meter({ value, tone = "teal" }: { value: number; tone?: "teal" | "amber" | "orange" }) {
  const colors: Record<string, string> = {
    teal: "bg-teal",
    amber: "bg-amber",
    orange: "bg-orange",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
