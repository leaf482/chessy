"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { RUN_STATUS_EVENT } from "@/store/run";

const LINKS = [
  { href: "/", label: "Mission" },
  { href: "/play", label: "Play" },
  { href: "/watch", label: "Watch" },
  { href: "/lineage", label: "Lineage" },
  { href: "/evolve", label: "Evolve" },
  { href: "/presets", label: "Presets" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ running: boolean; generation: number }>).detail;
      setRunning(detail.running);
      setStatus(detail.running ? `Gen ${detail.generation} · Running` : "Idle");
    };
    window.addEventListener(RUN_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(RUN_STATUS_EVENT, onStatus);
  }, []);

  return (
    <div className="min-h-screen bg-background text-white">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-background px-5">
        <Link href="/" className="text-sm tracking-[0.2em]" onClick={() => setOpen(false)}>
          CHESSY
        </Link>
        <nav className="hidden items-center gap-6 min-[960px]:flex">
          {LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} active={isActive(pathname, link.href)}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <p className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-faint uppercase">
            {running ? <span className="running-dot h-1.5 w-1.5 bg-signal" /> : null}
            {status}
          </p>
          <button
            type="button"
            className="text-[11px] tracking-[0.14em] text-muted uppercase opacity-80 hover:opacity-100 min-[960px]:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>
      </header>
      {open ? (
        <div className="border-b border-line px-5 py-4 min-[960px]:hidden">
          <div className="flex flex-col gap-3">
            {LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                active={isActive(pathname, link.href)}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
      <main className="px-5 py-10">{children}</main>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`text-[11px] tracking-[0.14em] uppercase ${active ? "text-white opacity-100" : "text-muted opacity-80 hover:opacity-100"}`}
    >
      {children}
    </Link>
  );
}
