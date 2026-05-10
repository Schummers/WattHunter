"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns `true` when the user is scrolling up (or at the top),
 * `false` when scrolling down. Listens on the nearest `<main>` element
 * (which is the scroll container in the WattHunter layout).
 */
export function useScrollDirection() {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const handleScroll = () => {
      const currentY = main.scrollTop;
      if (currentY > lastScrollY.current && currentY > 32) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };

    // Double rAF: ensures we read the final scrollTop AFTER any programmatic
    // scrollIntoView (fired in a sibling's useLayoutEffect) has fully settled —
    // including on Safari where "auto" scroll can animate across a few frames.
    // Without this, we'd initialise lastScrollY at 0, and the very first scroll
    // event (fired as scrollIntoView lands) would trigger the hide logic.
    let frameId: number;
    frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(() => {
        lastScrollY.current = main.scrollTop;
        main.addEventListener("scroll", handleScroll, { passive: true });
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
      main.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return visible;
}
