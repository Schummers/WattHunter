"use client";

import Link from "next/link";
import { useRail } from "@/contexts/rail-context";

const RAIL_PATTERNS = [
  /\/league\/[^/]+\/rider\//,
  /\/league\/[^/]+\/levels$/,
  /\/league\/[^/]+\/team\/policies$/,
];

function isRailEligible(href: string): boolean {
  return RAIL_PATTERNS.some((p) => p.test(href));
}

export function RailLink(props: React.ComponentProps<typeof Link>) {
  const { openRail } = useRail();
  const href = typeof props.href === "string" ? props.href : props.href.toString();

  return (
    <Link
      {...props}
      onClick={(e) => {
        if (window.innerWidth >= 1024 && isRailEligible(href)) {
          e.preventDefault();
          openRail(href);
        }
        if (typeof props.onClick === "function") {
          props.onClick(e as React.MouseEvent<HTMLAnchorElement>);
        }
      }}
    />
  );
}
