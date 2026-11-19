"use client";

import { useEffect, useRef } from "react";

type Options = {
  onPullToRefresh?: () => void;
  threshold?: number;
};

/**
 * Hook to detect pull-to-refresh gesture on mobile
 * Prevents default browser pull-to-refresh and calls a callback instead
 */
export function usePullToRefresh({ onPullToRefresh, threshold = 60 }: Options) {
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleTouchStart(e: TouchEvent) {
      scrollTop.current = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop.current === 0) {
        touchStartY.current = e.touches[0].clientY;
      }
    }

    function handleTouchMove(e: TouchEvent) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      // If scrolled to top and dragging down beyond threshold
      if (scrollTop.current === 0 && diff > threshold && touchStartY.current > 0) {
        e.preventDefault();
        onPullToRefresh?.();
      }
    }

    function handleTouchEnd() {
      touchStartY.current = 0;
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onPullToRefresh, threshold]);
}
