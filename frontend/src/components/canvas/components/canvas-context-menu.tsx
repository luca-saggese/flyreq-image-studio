"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Copy, Crop, Eraser, Grid3x3, Maximize2, PaintBucket, RefreshCw, Rotate3d, Sparkles, Text, Trash2, Type } from "lucide-react";

import { CanvasNodeType, type CanvasNodeData, type ContextMenuState } from "../types";
import { useI18n } from "@/components/LanguageProvider";

export type CanvasContextMenuActions = {
  onGenerate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeleteImageOnly: () => void;
  onRetry: () => void;
  onCrop: () => void;
  onSplit: () => void;
  onUpscale: () => void;
  onAngle: () => void;
  onDeleteConnection: () => void;
  onToggleRenderMode?: () => void;
  onAnnotationChangeColor?: () => void;
  onAnnotationChangeFontSize?: () => void;
};

export function CanvasContextMenu({ state, node, onClose, actions }: { state: ContextMenuState | null; node?: CanvasNodeData; onClose: () => void; actions: CanvasContextMenuActions }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!state) return;
    const handle = () => onClose();
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", handle);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handle);
      window.removeEventListener("keydown", handleKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const isImage = state.type === "node" && node?.type === CanvasNodeType.Image && Boolean(node.metadata?.content);
  const canGenerate = state.type === "node" && node?.type === CanvasNodeType.Config;
  const canRetry = state.type === "node" && node?.type === CanvasNodeType.Image && node.metadata?.status === "error";
  const isText = state.type === "node" && node?.type === CanvasNodeType.Text;
  const isAnnotation = state.type === "node" && node?.type === CanvasNodeType.TextAnnotation;

  const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];
  if (state.type === "connection") {
    items.push({ label: t("canvas.context.deleteConnection"), icon: <Trash2 className="size-4" />, onClick: actions.onDeleteConnection, danger: true });
  } else {
    if (canGenerate) items.push({ label: t("canvas.context.generate"), icon: <Sparkles className="size-4" />, onClick: actions.onGenerate });
    if (isImage) {
      items.push({ label: t("canvas.context.crop"), icon: <Crop className="size-4" />, onClick: actions.onCrop });
      items.push({ label: t("canvas.context.split"), icon: <Grid3x3 className="size-4" />, onClick: actions.onSplit });
      items.push({ label: t("canvas.context.upscale"), icon: <Maximize2 className="size-4" />, onClick: actions.onUpscale });
      items.push({ label: t("canvas.context.angle"), icon: <Rotate3d className="size-4" />, onClick: actions.onAngle });
      items.push({ label: t("canvas.context.deleteImage"), icon: <Eraser className="size-4" />, onClick: actions.onDeleteImageOnly });
    }
    if (isText && actions.onToggleRenderMode) {
      items.push({ label: t("canvas.context.toggleMarkdown"), icon: <Text className="size-4" />, onClick: actions.onToggleRenderMode });
    }
    if (isAnnotation && actions.onAnnotationChangeColor) {
      items.push({ label: t("canvas.context.changeColor"), icon: <PaintBucket className="size-4" />, onClick: actions.onAnnotationChangeColor });
    }
    if (isAnnotation && actions.onAnnotationChangeFontSize) {
      items.push({ label: t("canvas.context.changeFontSize"), icon: <Type className="size-4" />, onClick: actions.onAnnotationChangeFontSize });
    }
    if (canRetry) items.push({ label: t("canvas.context.regenerate"), icon: <RefreshCw className="size-4" />, onClick: actions.onRetry });
    items.push({ label: t("canvas.context.duplicate"), icon: <Copy className="size-4" />, onClick: actions.onDuplicate });
    items.push({ label: t("canvas.delete"), icon: <Trash2 className="size-4" />, onClick: actions.onDelete, danger: true });
  }

  return createPortal(
    <div
      data-canvas-no-zoom
      className="fixed z-[130] min-w-40 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
      style={{ left: state.x, top: state.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted ${item.danger ? "text-destructive hover:bg-destructive/10" : "text-foreground"}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
