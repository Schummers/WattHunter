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

    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, []);

  return visible;
}
