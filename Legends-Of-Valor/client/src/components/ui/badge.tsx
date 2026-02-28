import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-serif font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border-primary/40 bg-primary/20 text-primary shadow-xs",
        secondary: "border-secondary/40 bg-secondary/30 text-secondary-foreground",
        destructive:
          "border-destructive/40 bg-destructive/20 text-destructive shadow-xs",
        outline: "border-[hsl(45_40%_30%_/_0.4)] bg-transparent shadow-xs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
