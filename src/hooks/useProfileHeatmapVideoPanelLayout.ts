"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampProfileVideoPanelRect,
  parseStoredProfileVideoPanelLayout,
  PROFILE_HEATMAP_VIDEO_PANEL_LAYOUT_KEY,
  type ProfileVideoPanelRect,
} from "@/utils/profileHeatmapVideoPanelLayout";

type DragSession =
  | { kind: "move"; startX: number; startY: number; rect: ProfileVideoPanelRect }
  | { kind: "resize"; startX: number; startY: number; rect: ProfileVideoPanelRect };

/**
 * Stan przeciągania i zmiany rozmiaru panelu wideo (portal profilu).
 * Pozycja zapisywana w localStorage pod {@link PROFILE_HEATMAP_VIDEO_PANEL_LAYOUT_KEY}.
 */
export function useProfileHeatmapVideoPanelLayout() {
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ProfileVideoPanelRect | null>(null);
  const layoutRef = useRef<ProfileVideoPanelRect | null>(null);
  layoutRef.current = layout;
  const dragRef = useRef<DragSession | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(PROFILE_HEATMAP_VIDEO_PANEL_LAYOUT_KEY);
    const parsed = parseStoredProfileVideoPanelLayout(raw);
    if (parsed) {
      setLayout(clampProfileVideoPanelRect(parsed, window.innerWidth, window.innerHeight));
    }
  }, []);

  const persist = useCallback((r: ProfileVideoPanelRect | null) => {
    if (typeof window === "undefined") return;
    if (r === null) {
      localStorage.removeItem(PROFILE_HEATMAP_VIDEO_PANEL_LAYOUT_KEY);
      return;
    }
    try {
      localStorage.setItem(PROFILE_HEATMAP_VIDEO_PANEL_LAYOUT_KEY, JSON.stringify(r));
    } catch {
      /* quota / private mode */
    }
  }, []);

  const resetLayout = useCallback(() => {
    persist(null);
    setLayout(null);
  }, [persist]);

  const measurePanel = useCallback((): ProfileVideoPanelRect | null => {
    const el = panelRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return clampProfileVideoPanelRect(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      window.innerWidth,
      window.innerHeight,
    );
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    const cur = layoutRef.current;
    if (cur) persist(cur);
  }, [persist]);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      const base = layout ?? measurePanel();
      if (!base) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { kind: "move", startX: e.clientX, startY: e.clientY, rect: base };
      if (!layout) setLayout(base);
    },
    [layout, measurePanel],
  );

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const base = layout ?? measurePanel();
      if (!base) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { kind: "resize", startX: e.clientX, startY: e.clientY, rect: base };
      if (!layout) setLayout(base);
    },
    [layout, measurePanel],
  );

  const onDragPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (d.kind === "move") {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setLayout(
        clampProfileVideoPanelRect(
          {
            left: d.rect.left + dx,
            top: d.rect.top + dy,
            width: d.rect.width,
            height: d.rect.height,
          },
          vw,
          vh,
        ),
      );
    } else {
      /* Uchwyt w lewym górnym rogu: ruch w lewo/górę powiększa panel (kotwica przy prawym dolnym rogu). */
      const dw = e.clientX - d.startX;
      const dh = e.clientY - d.startY;
      setLayout(
        clampProfileVideoPanelRect(
          {
            left: d.rect.left + dw,
            top: d.rect.top + dh,
            width: d.rect.width - dw,
            height: d.rect.height - dh,
          },
          vw,
          vh,
        ),
      );
    }
  }, []);

  const onDragPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!dragRef.current) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* not captured */
      }
      endDrag();
    },
    [endDrag],
  );

  const panelStyle: CSSProperties | undefined = layout
    ? {
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        right: "auto",
        bottom: "auto",
        maxHeight: "none",
      }
    : undefined;

  return {
    panelRef,
    layout,
    panelStyle,
    resetLayout,
    onHeaderPointerDown,
    onResizePointerDown,
    onDragPointerMove,
    onDragPointerUp,
  };
}
