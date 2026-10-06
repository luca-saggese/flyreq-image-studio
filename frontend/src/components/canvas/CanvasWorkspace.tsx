"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FolderOpen, Layers, Plus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/LanguageProvider";
import { CanvasEditor } from "./CanvasEditor";
import { CanvasThumbnail } from "./components/canvas-thumbnail";
import { useCanvasStore } from "./stores/use-canvas-store";
import { exportCanvasProjects, importCanvasProjectsFromZip } from "./utils/canvas-export";

type CanvasWorkspaceProps = {
  onConfigureApiKey: () => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  showPromptGallery?: boolean;
};

type SortMode = "updated" | "created" | "name";

/** 渲染无限画布项目列表或当前画布编辑器。
 * @param props 画布配置、API Key 配置回调及提示消息回调。
 * @returns 画布工作区界面。
 */
export function CanvasWorkspace({ onConfigureApiKey, showToast, showPromptGallery }: CanvasWorkspaceProps) {
  const { locale, t } = useI18n();
  const hydrated = useCanvasStore((state) => state.hydrated);
  const projects = useCanvasStore((state) => state.projects);
  const createProject = useCanvasStore((state) => state.createProject);
  const renameProject = useCanvasStore((state) => state.renameProject);
  const deleteProjects = useCanvasStore((state) => state.deleteProjects);
  const importProject = useCanvasStore((state) => state.importProject);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [mounted, setMounted] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "updated", label: t("canvas.sort.updated") },
    { value: "created", label: t("canvas.sort.created") },
    { value: "name", label: t("canvas.sort.name") },
  ];

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const sortedProjects = useMemo(() => {
    const list = [...projects];
    if (sortMode === "name") list.sort((a, b) => a.title.localeCompare(b.title, locale));
    else if (sortMode === "created") list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }, [locale, projects, sortMode]);

  if (activeProjectId) {
    return (
      <div className="relative h-full min-h-[70vh] w-full overflow-hidden rounded-2xl border border-border bg-card">
        <CanvasEditor projectId={activeProjectId} onBack={() => setActiveProjectId(null)} onRequireApiKey={onConfigureApiKey} showToast={showToast} showPromptGallery={showPromptGallery} />
      </div>
    );
  }

  const handleImport = async (file: File) => {
    try {
      const imported = await importCanvasProjectsFromZip(file);
      imported.forEach((project) => importProject(project));
      showToast(t("canvas.imported", { count: imported.length }), "success");
    } catch {
      showToast(t("canvas.importFailed"), "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("canvas.workspaceTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("canvas.workspaceDescription")}</p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <Select<SortMode> value={sortMode} onValueChange={setSortMode} options={sortOptions} size="sm" contentClassName="min-w-32" />
          )}
          <input ref={importInputRef} type="file" accept=".zip" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); event.target.value = ""; }} />
          <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
            <Upload className="size-4" />
            {t("canvas.import")}
          </Button>
          <Button size="sm" onClick={() => setActiveProjectId(createProject())}>
            <Plus className="size-4" />
            {t("canvas.new")}
          </Button>
        </div>
      </div>

      {!mounted || !hydrated ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">{t("canvas.loading")}</div>
      ) : projects.length === 0 ? (
        <button
          type="button"
          onClick={() => setActiveProjectId(createProject())}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Layers className="size-8" />
          {t("canvas.empty")}
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project) => (
            <div key={project.id} className={cn("group flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40")}>
              <button type="button" className="block w-full" aria-label={t("canvas.openAria")} onClick={() => setActiveProjectId(project.id)}>
                <CanvasThumbnail nodes={project.nodes} />
              </button>

              {editingId === project.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    renameProject(project.id, editingTitle);
                    setEditingId(null);
                  }}
                >
                  <Input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onBlur={() => { renameProject(project.id, editingTitle); setEditingId(null); }} />
                </form>
              ) : (
                <button type="button" className="w-full rounded-md text-left transition-colors hover:text-primary" title={t("canvas.rename")} onClick={() => { setEditingId(project.id); setEditingTitle(project.title); }}>
                  <span className="line-clamp-1 font-medium">{project.title}</span>
                </button>
              )}

              <p className="text-xs text-muted-foreground">
                {t("canvas.nodes", { count: project.nodes.length })} · {new Date(project.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setActiveProjectId(project.id)}>
                  <FolderOpen className="size-4" />
                  {t("canvas.open")}
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t("canvas.export")} onClick={() => void exportCanvasProjects([project], project.title || t("canvas.workspaceTitle"))}>
                  <Download className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t("canvas.delete")} onClick={() => setDeleteId(project.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("canvas.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("canvas.deleteDescription")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("canvas.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteId) deleteProjects([deleteId]);
                setDeleteId(null);
              }}
            >
              {t("canvas.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
