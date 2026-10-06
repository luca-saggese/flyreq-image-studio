"use client";

import type { ReactNode } from "react";
import { Compass, Focus, HelpCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { canvasTheme } from "../lib/canvas-theme";
import { CanvasTooltip } from "./canvas-ui";
import { useI18n } from "@/components/LanguageProvider";

type CanvasZoomControlsProps = {
  scale: number;
  onScaleChange: (scale: number) => void;
  onReset: () => void;
  isMiniMapOpen: boolean;
  onToggleMiniMap: () => void;
};

export function CanvasZoomControls({ scale, onScaleChange, onReset, isMiniMapOpen, onToggleMiniMap }: CanvasZoomControlsProps) {
  const { t } = useI18n();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const theme = canvasTheme;

  return (
    <div className="absolute bottom-5 left-5 z-50" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex h-14 items-center gap-1 rounded-xl border border-border bg-card/95 px-2 shadow-lg backdrop-blur">
        <CanvasTooltip label={isMiniMapOpen ? t("canvas.zoom.closeMinimap") : t("canvas.zoom.openMinimap")}>
          <Button variant={isMiniMapOpen ? "secondary" : "ghost"} size="icon-sm" onClick={onToggleMiniMap} aria-label={isMiniMapOpen ? t("canvas.zoom.closeMinimap") : t("canvas.zoom.openMinimap")}>
            <Compass className="size-4" />
          </Button>
        </CanvasTooltip>
        <CanvasTooltip label={t("canvas.zoom.reset")}>
          <Button variant="ghost" size="icon-sm" onClick={onReset} aria-label={t("canvas.zoom.reset")}>
            <Focus className="size-4" />
          </Button>
        </CanvasTooltip>
        <input
          type="range"
          min="5"
          max="500"
          step="1"
          value={Math.round(scale * 100)}
          className="w-24"
          style={{ accentColor: theme.node.activeStroke }}
          onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
          aria-label={t("canvas.zoom.slider")}
        />
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
        <CanvasTooltip label={t("canvas.zoom.shortcuts")}>
          <Button variant={shortcutsOpen ? "secondary" : "ghost"} size="icon-sm" onClick={() => setShortcutsOpen(true)} aria-label={t("canvas.zoom.shortcuts")}>
            <HelpCircle className="size-4" />
          </Button>
        </CanvasTooltip>
      </div>
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("canvas.zoom.shortcuts")}</DialogTitle>
          </DialogHeader>
          <div className={cn("space-y-3 border-t border-border pt-4 text-sm")}>
            <Shortcut label={t("canvas.zoom.panLabel")} value={t("canvas.zoom.panValue")} />
            <Shortcut label={t("canvas.zoom.wheelLabel")} value={t("canvas.zoom.wheelValue")} />
            <Shortcut label={t("canvas.zoom.selectLabel")} value={t("canvas.zoom.selectValue")} />
            <Shortcut label={t("canvas.zoom.addLabel")} value={t("canvas.zoom.addValue")} />
            <Shortcut label={t("canvas.zoom.copyLabel")} value={t("canvas.zoom.copyValue")} />
            <Shortcut label={t("canvas.zoom.deleteLabel")} value={t("canvas.zoom.deleteValue")} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Shortcut({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-base font-medium">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}
