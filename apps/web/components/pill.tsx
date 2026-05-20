import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tagVariants = cva(
  /* DS canonical: tag padding-y = 3px (intentional — no Tailwind utility covers 3px exactly; py-0.5=2px too small, py-1=4px too large). MISSING_TOKEN: candidate --space-tag-y for future DS token audit. */
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] py-[3px] px-2.5 text-[length:var(--type-caption)] font-medium [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[var(--border-default)] text-[var(--text-low)]",
        highlighted:
          "bg-[var(--badge-bg)] text-[var(--accent-label)]",
        success:
          "bg-[var(--success-bg)] text-[var(--success)]",
        warning:
          "bg-[var(--warning-bg)] text-[var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface TagProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof tagVariants> {}

export function Tag({ className, variant, children, ...props }: TagProps) {
  return (
    <span className={cn(tagVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}

/** @deprecated Use Tag instead */
export const Pill = Tag;

export { tagVariants };
