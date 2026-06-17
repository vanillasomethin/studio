import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // ── Untitled UI–style soft pill badges ──────────────────────────
        success: "border-green-200 bg-green-50 text-green-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        error:   "border-red-200 bg-red-50 text-red-700",
        info:    "border-blue-200 bg-blue-50 text-blue-700",
        brand:   "border-primary/20 bg-primary/5 text-primary",
        gray:    "border-gray-200 bg-gray-50 text-gray-700",
        purple:  "border-purple-200 bg-purple-50 text-purple-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Dot color per soft-pill variant, used when `dot` is set.
const badgeDotColor: Record<string, string> = {
  success: "bg-green-500",
  warning: "bg-amber-500",
  error:   "bg-red-500",
  info:    "bg-blue-500",
  brand:   "bg-primary",
  gray:    "bg-gray-400",
  purple:  "bg-purple-500",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Render a small status dot before the label (Untitled UI "dot badge" pattern). */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", badgeDotColor[variant ?? "gray"] ?? "bg-gray-400")} />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
