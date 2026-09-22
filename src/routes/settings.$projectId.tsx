import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { deleteProject, getProject, upsertProject } from "@/lib/plan/storage";
import type { Project, ScaleOption, Units } from "@/lib/plan/types";

export const Route = createFileRoute("/settings/$projectId")({
  head: () => ({
    meta: [
      { title: "Project settings — Planche" },
      { name: "description", content: "Rename your floor plan, choose metric or imperial units and set the default export scale." },
      { property: "og:title", content: "Project settings — Planche" },
      { property: "og:description", content: "Rename your floor plan, choose units and the default export scale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [scale, setScale] = useState<ScaleOption>(50);
  const [units, setUnits] = useState<Units>("metric");

  useEffect(() => {
    const p = getProject(projectId) ?? null;
    setProject(p);
    if (p) {
      setName(p.name);
      setScale(p.default_scale);
      setUnits(p.units);
    }
  }, [projectId]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const updated = { ...project, name: name.trim() || project.name, default_scale: scale, units, updated_at: new Date().toISOString() };
    upsertProject(updated);
    setProject(updated);
    toast.success("Settings saved");
    navigate({ to: "/editor/$projectId", params: { projectId } });
  };

  const remove = () => {
    if (!confirm("Delete this project permanently?")) return;
    deleteProject(projectId);
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-xl">
          <Link to="/editor/$projectId" params={{ projectId }} className="btn-ghost -ml-3 h-8 text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back to editor
          </Link>
          {project === undefined ? null : project === null ? (
            <p className="mt-6">This project doesn't exist.</p>
          ) : (
            <form onSubmit={save} className="mt-4">
              <p className="label-caps">Project settings</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{project.name}</h1>

              <div className="panel mt-8 space-y-6 p-6">
                <label className="block">
                  <span className="label-caps mb-1.5 block">Project name</span>
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>

                <div>
                  <span className="label-caps mb-1.5 block">Units</span>
                  <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                    {(
                      [
                        ["metric", "Metric", "50 cm grid, 10 cm snap"],
                        ["imperial", "Imperial", "1 ft grid, 3 in snap"],
                      ] as [Units, string, string][]
                    ).map(([v, label, sub]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setUnits(v)}
                        className={`rounded px-3 py-2 text-left transition-colors ${units === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-xs text-muted-foreground">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="label-caps mb-1.5 block">Default export scale</span>
                  <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                    {([50, 100, "fit"] as ScaleOption[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScale(s)}
                        className={`h-9 rounded text-sm font-medium transition-colors ${scale === s ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {s === "fit" ? "Fit to page" : `1:${s}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-5">
                  <button type="button" className="btn-ghost text-destructive" onClick={remove}>
                    Delete project
                  </button>
                  <button type="submit" className="btn-primary">
                    Save settings
                  </button>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-3 font-mono text-xs text-muted-foreground">
                <div>
                  <dt className="label-caps">Created</dt>
                  <dd className="mt-1">{new Date(project.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="label-caps">Last edited</dt>
                  <dd className="mt-1">{new Date(project.updated_at).toLocaleString()}</dd>
                </div>
              </dl>
            </form>
          )}
        </div>
      </main>
    </AppShell>
  );
}
