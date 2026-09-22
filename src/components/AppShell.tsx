import { Link } from "@tanstack/react-router";
import { LayoutGrid, PenLine } from "lucide-react";
import type { ReactNode } from "react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-primary-foreground">
        <PenLine className="h-4 w-4" />
      </span>
      {!compact && <span className="text-lg font-semibold tracking-tight">Planche</span>}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 md:flex">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="mt-8 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "bg-accent text-foreground" }}
            activeOptions={{ exact: true }}
          >
            <LayoutGrid className="h-4 w-4" /> Projects
          </Link>
        </nav>
        <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
          Sketch floor plans without CAD. Everything is saved in this browser.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b border-border px-4 py-3 md:hidden">
          <Link to="/">
            <Logo />
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
