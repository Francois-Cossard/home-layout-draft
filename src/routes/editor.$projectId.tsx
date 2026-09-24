import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Copy, FileDown, Maximize2, Settings2, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PlanCanvas } from "@/components/plan/PlanCanvas";
import { FurnitureLibrary } from "@/components/plan/FurnitureLibrary";
import { PropertiesPanel } from "@/components/plan/PropertiesPanel";
import { Toolbar, TOOL_KEYS } from "@/components/plan/Toolbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { exportPlanPdf } from "@/lib/plan/pdf";
import { getProject } from "@/lib/plan/storage";
import { useEditor } from "@/lib/plan/store";
import type { PaperSize, ScaleOption } from "@/lib/plan/types";

export const Route = createFileRoute("/editor/$projectId")({
  head: () => ({
    meta: [
      { title: "Plan editor — Planche" },
      { name: "description", content: "Draw walls, place doors and windows, label rooms and export your floor plan as a vector PDF." },
      { property: "og:title", content: "Plan editor — Planche" },
      { property: "og:description", content: "Draw walls, place doors and windows, label rooms and export a vector PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const { projectId } = Route.useParams();
  const project = useEditor((s) => s.project);
  const load = useEditor((s) => s.load);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const p = getProject(projectId);
    if (p) load(p);
    else setMissing(true);
  }, [projectId, load]);

  if (missing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-lg font-medium">This plan doesn't exist.</p>
        <Link to="/" className="btn-outline">
          Back to projects
        </Link>
      </div>
    );
  }
  if (!project || project.id !== projectId) {
    return <div className="paper-texture min-h-screen" />;
  }
  return <Editor />;
}

function Editor() {
  const project = useEditor((s) => s.project)!;
  const setTool = useEditor((s) => s.setTool);
  const tool = useEditor((s) => s.tool);
  const select = useEditor((s) => s.select);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const deleteSelected = useEditor((s) => s.deleteSelected);
  const duplicateSelected = useEditor((s) => s.duplicateSelected);
  const selection = useEditor((s) => s.selection);
  const isMobile = useIsMobile();

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const viewRef = useRef<{ zoomBy: (f: number) => void; fit: () => void } | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }
      if (e.key === "Escape") {
        select(null);
        setMenu(null);
        setExportOpen(false);
        return;
      }
      if (!mod && !isMobile) {
        const t = TOOL_KEYS[e.key.toLowerCase()];
        if (t) setTool(t);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, select, setTool, selection, isMobile]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <Link to="/" className="btn-ghost -ml-1 h-8 px-2 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Projects</span>
        </Link>
        <div className="h-5 w-px bg-border" />
        <h1 className="truncate text-sm font-semibold">{project.name}</h1>
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
          {project.units === "metric" ? "Metric" : "Imperial"} · default 1:{project.default_scale === "fit" ? "fit" : project.default_scale}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="tool-btn h-8 w-8" title="Zoom out" onClick={() => viewRef.current?.zoomBy(1 / 1.25)}>
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" className="tool-btn h-8 w-8" title="Zoom in" onClick={() => viewRef.current?.zoomBy(1.25)}>
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" className="tool-btn h-8 w-8" title="Fit to screen" onClick={() => viewRef.current?.fit()}>
            <Maximize2 className="h-4 w-4" />
          </button>
          <Link to="/settings/$projectId" params={{ projectId: project.id }} className="tool-btn h-8 w-8" title="Project settings">
            <Settings2 className="h-4 w-4" />
          </Link>
          <div className="relative ml-1">
            <button type="button" className="btn-primary h-8" onClick={() => setExportOpen((o) => !o)}>
              <FileDown className="h-4 w-4" /> Export PDF
            </button>
            {exportOpen && <ExportPopover onClose={() => setExportOpen(false)} />}
          </div>
        </div>
      </header>

      {isMobile && (
        <div className="bg-blueprint-soft px-3 py-1.5 text-center text-xs text-foreground">
          View-only on small screens — open on a tablet or desktop to edit.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {!isMobile && <Toolbar />}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <PlanCanvas readOnly={isMobile} onContextMenu={setMenu} viewRef={viewRef} />
          {!isMobile && tool === "furniture" && <FurnitureLibrary onClose={() => setTool("select")} />}
        </div>
        {!isMobile && <PropertiesPanel />}
      </div>

      {menu && selection && (
        <div
          className="panel fixed z-50 min-w-40 p-1 shadow-float"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-sm hover:bg-accent"
            onClick={() => {
              duplicateSelected();
              setMenu(null);
            }}
          >
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-sm text-destructive hover:bg-accent"
            onClick={() => {
              deleteSelected();
              setMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ExportPopover({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project)!;
  const [paper, setPaper] = useState<PaperSize>("a4");
  const [scale, setScale] = useState<ScaleOption>(project.default_scale);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await exportPlanPdf(project, { paper, scale });
      toast.success("PDF exported");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel absolute top-10 right-0 z-40 w-64 p-4 shadow-float" onPointerDown={(e) => e.stopPropagation()}>
      <p className="label-caps">Export</p>
      <h3 className="mt-0.5 text-sm font-semibold">Vector PDF</h3>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="label-caps mb-1.5 block">Paper</span>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {(["a4", "a3"] as PaperSize[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`h-7 rounded text-xs font-medium uppercase ${paper === p ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setPaper(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="label-caps mb-1.5 block">Scale</span>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
            {([50, 100, "fit"] as ScaleOption[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`h-7 rounded text-xs font-medium ${scale === s ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setScale(s)}
              >
                {s === "fit" ? "Fit page" : `1:${s}`}
              </button>
            ))}
          </div>
        </label>
        <p className="text-xs text-muted-foreground">Orientation is chosen automatically from the plan's shape.</p>
        <button type="button" className="btn-primary w-full" onClick={run} disabled={busy}>
          <FileDown className="h-4 w-4" /> {busy ? "Generating…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
