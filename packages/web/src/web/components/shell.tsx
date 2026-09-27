import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "../lib/utils";
import { formatRf, useSimRf } from "../lib/store";
import { useIdentitySync } from "../lib/hooks";
import { Deck } from "./deck";
import { WalletButton } from "./wallet-button";

const NAV = [
  { href: "/", label: "Radio" },
  { href: "/explore", label: "Explore" },
  { href: "/charts", label: "Charts" },
  { href: "/atlas", label: "Atlas" },
  { href: "/mine", label: "My Friends" },
  { href: "/about", label: "About" },
];

/**
 * The nav is rendered twice: inline on desktop, and on its own scrollable line
 * under the header on phones, where six labels next to a wallet button would
 * otherwise get squeezed down to three letters each.
 */
function NavLinks({ path, className }: { path: string; className?: string }) {
  return (
    <nav className={cn("no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1", className)}>
      {NAV.map((item) => {
        const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "data press shrink-0 rounded-[4px] border px-2.5 py-1.5 text-[10px] tracking-[0.12em] whitespace-nowrap uppercase",
              active
                ? "border-teal/40 bg-teal/10 text-teal"
                : "border-transparent text-ink-dim hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  useIdentitySync();
  const [path] = useLocation();
  const { balance } = useSimRf();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-line bg-bg/88 backdrop-blur-md">
        <div className="mx-auto max-w-[1180px] px-3 sm:px-6">
          <div className="flex h-12 items-center gap-3 sm:h-14 sm:gap-4">
            <Link href="/" className="group flex shrink-0 items-center gap-2">
              <img
                src="/logo.png"
                alt="Friendstune"
                width={28}
                height={28}
                className="size-6 shrink-0 select-none sm:size-7"
                draggable={false}
              />
              <span className="font-display text-[13px] font-bold tracking-[0.14em] text-ink uppercase group-hover:text-teal sm:text-[15px]">
                Friendstune
              </span>
            </Link>

            <NavLinks path={path} className="hidden flex-1 md:flex" />
            <div className="flex-1 md:hidden" />

            <Link
              href="/mine"
              title="Simulated RF, local only, never the real token"
              className="data press flex shrink-0 items-center gap-1.5 rounded-[4px] border border-amber/35 bg-amber/8 px-2 py-1.5 text-[10px] text-amber hover:bg-amber/14 sm:px-2.5"
            >
              <span className="tracking-[0.12em]">{formatRf(balance)} RF</span>
              <span className="hidden text-[9px] tracking-[0.1em] text-amber/60 sm:inline">
                SIM
              </span>
            </Link>

            <WalletButton />
          </div>

          <NavLinks path={path} className="pb-2 md:hidden" />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-3 pt-4 pb-[164px] sm:px-6 sm:pt-7 sm:pb-[150px]">
        {children}
      </main>

      <Deck />
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  children,
  right,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="ft-rise mb-4 flex flex-col gap-3 sm:mb-6 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="max-w-2xl">
        {eyebrow && <div className="micro mb-1.5 sm:mb-2">{eyebrow}</div>}
        <h1 className="font-display text-[25px] leading-[1.08] font-bold text-ink sm:text-[34px] lg:text-[44px]">
          {title}
        </h1>
        {/* On a phone the controls come before the prose, so the primary
            button is reachable without scrolling. */}
        {right && (
          <div className="mt-3 flex flex-wrap items-center gap-2 md:hidden">{right}</div>
        )}
        {children && (
          <div className="mt-3 text-[13px] leading-relaxed text-ink-dim sm:text-sm">{children}</div>
        )}
      </div>
      {right && <div className="hidden shrink-0 items-center gap-2 md:flex">{right}</div>}
    </div>
  );
}
