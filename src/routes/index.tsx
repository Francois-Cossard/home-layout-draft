import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PlanThumbnail } from "@/components/plan/PlanThumbnail";
import { createProject, deleteProject, loadProjects } from "@/lib/plan/storage";
import type { Project } from "@/lib/plan/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Planche — Sketch floor plans in your browser" },
      { name: "description", content: "Draw 2D floor plans of apartments and houses: walls, rooms, doors, windows, and export a crisp vector PDF." },
      { property: "og:title", content: "Planche — Sketch floor plans in your browser" },
      { property: "og:description", content: "Draw walls, rooms, doors and windows, then export a vector PDF at 1:50 or 1:100." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  const onNew = () => {
    const p = createProject(`Untitled plan ${(projects?.length ?? 0) + 1}`);
    navigate({ to: "/editor/$projectId", params: { projectId: p.id } });
  };

  const onDelete = (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    deleteProject(id);
    setProjects(loadProjects());
  };

  const filtered = (projects ?? [])
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <AppShell>
      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps">Drafting table</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your floor plans</h1>
            </div>
            <button type="button" className="btn-primary" onClick={onNew}>
              <Plus className="h-4 w-4" /> New project
            </button>
          </div>

          <div className="relative mt-6 max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field pl-9"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search projects"
            />
          </div>

          {projects === null ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="panel h-60 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="panel mt-8 flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-lg font-medium">{query ? "No plans match your search" : "No plans yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {query ? "Try another name." : "Start a new project and draw your first walls."}
              </p>
              {!query && (
                <button type="button" className="btn-primary mt-5" onClick={onNew}>
                  <Plus className="h-4 w-4" /> New project
                </button>
              )}
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <div key={p.id} className="panel group relative overflow-hidden transition-shadow hover:shadow-float">
                  <Link to="/editor/$projectId" params={{ projectId: p.id }} className="block">
                    <div className="paper-texture flex h-44 items-center justify-center border-b border-border p-4">
                      {p.walls.length ? (
                        <PlanThumbnail data={p} className="h-full w-full" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Empty plan</span>
                      )}
                    </div>
                    <div className="px-4 py-3">
                      <h2 className="font-semibold">{p.name}</h2>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {p.rooms.length} rooms · {p.walls.length} walls · edited{" "}
                        {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => onDelete(p.id)}
                    className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md bg-card/90 text-muted-foreground opacity-0 shadow-panel transition-opacity group-hover:opacity-100 hover:text-destructive focus:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
