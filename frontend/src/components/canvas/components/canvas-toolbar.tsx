"use client";

import { CircleDot, Grid2x2, Image as ImageIcon, Info, LayoutDashboard, LibraryBig, Redo2, Settings2, Square, Trash2, Type, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import type { CanvasBackgroundMode } from "../lib/canvas-theme";
import { CanvasTooltip } from "./canvas-ui";
import { useI18n } from "@/components/LanguageProvider";

type CanvasToolbarProps = {
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  backgroundMode: CanvasBackgroundMode;
  showImageInfo: boolean;
  showPromptGallery?: boolean;
  onAddImage: () => void;
  onAddText: () => void;
  onAddAnnotation: () => void;
  onAddConfig: () => void;
  onImportPromptGallery: () => void;
  onOpenTemplate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onBackgroundModeChange: (mode: CanvasBackgroundMode) => void;
  onShowImageInfoChange: (value: boolean) => void;
};

export function CanvasToolbar({
  selectedCount,
  canUndo,
  canRedo,
  backgroundMode,
  showImageInfo,
  showPromptGallery = true,
  onAddImage,
  onAddText,
  onAddAnnotation,
  onAddConfig,
  onImportPromptGallery,
  onOpenTemplate,
  onUndo,
  onRedo,
  onDelete,
  onBackgroundModeChange,
  onShowImageInfoChange,
}: CanvasToolbarProps) {
  const { t } = useI18n();
  return (
    <div
      data-canvas-no-zoom
      className="absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <CanvasTooltip label={t("canvas.toolbar.addImage")}>
        <Button variant="ghost" size="icon-sm" onClick={onAddImage} aria-label={t("canvas.toolbar.addImage")}>
          <ImageIcon className="size-4" />
        </Button>
      </CanvasTooltip>
      <CanvasTooltip label={t("canvas.toolbar.addText")}>
        <Button variant="ghost" size="icon-sm" onClick={onAddText} aria-label={t("canvas.toolbar.addText")}>
          <Type className="size-4" />
        </Button>
      </CanvasTooltip>
      <CanvasTooltip label={t("canvas.toolbar.addAnnotation")}>
        <Button variant="ghost" size="icon-sm" onClick={onAddAnnotation} aria-label={t("canvas.toolbar.addAnnotation")}>
          <Square className="size-4" />
        </Button>
      </CanvasTooltip>
      <CanvasTooltip label={t("canvas.toolbar.addConfig")}>
        <Button variant="ghost" size="icon-sm" onClick={onAddConfig} aria-label={t("canvas.toolbar.addConfig")}>
          <Settings2 className="size-4" />
        </Button>
      </CanvasTooltip>
      {showPromptGallery && (
        <CanvasTooltip label={t("canvas.toolbar.importPrompt")}>
          <Button variant="ghost" size="icon-sm" onClick={onImportPromptGallery} aria-label={t("canvas.toolbar.importPrompt")}>
            <LibraryBig className="size-4" />
          </Button>
        </CanvasTooltip>
      )}
      <CanvasTooltip label={t("canvas.toolbar.templates")}>
        <Button variant="ghost" size="icon-sm" onClick={onOpenTemplate} aria-label={t("canvas.toolbar.templates")}>
          <LayoutDashboard className="size-4" />
        </Button>
      </CanvasTooltip>

      <div className="mx-1 h-5 w-px bg-border" />

      <CanvasTooltip label={t("canvas.toolbar.undo")}>
        <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={onUndo} aria-label={t("canvas.toolbar.undo")}>
          <Undo2 className="size-4" />
        </Button>
      </CanvasTooltip>
      <CanvasTooltip label={t("canvas.toolbar.redo")}>
        <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={onRedo} aria-label={t("canvas.toolbar.redo")}>
          <Redo2 className="size-4" />
        </Button>
      </CanvasTooltip>

      <div className="mx-1 h-5 w-px bg-border" />

      <Segmented
        value={backgroundMode}
        onChange={onBackgroundModeChange}
        options={[
          { value: "lines", icon: <Grid2x2 />, title: t("canvas.toolbar.grid") },
          { value: "dots", icon: <CircleDot />, title: t("canvas.toolbar.dots") },
          { value: "blank", icon: <Square />, title: t("canvas.toolbar.blank") },
        ]}
      />

      <CanvasTooltip label={t("canvas.toolbar.imageInfo")}>
        <label className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground">
          <Info className="size-3.5" />
          <Switch checked={showImageInfo} onCheckedChange={onShowImageInfoChange} />
        </label>
      </CanvasTooltip>

      {selectedCount > 0 && (
        <>
          <div className="mx-1 h-5 w-px bg-border" />
          <CanvasTooltip label={t("canvas.toolbar.deleteSelected", { count: selectedCount })}>
            <Button variant="destructive" size="icon-sm" onClick={onDelete} aria-label={t("canvas.toolbar.deleteSelected", { count: selectedCount })}>
              <Trash2 className="size-4" />
            </Button>
          </CanvasTooltip>
        </>
      )}
    </div>
  );
}
