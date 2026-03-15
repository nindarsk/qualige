import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors border",
  {
    variants: {
      variant: {
        default: "border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success))]",
        secondary: "border-border bg-secondary text-muted-foreground",
        destructive: "border-[hsl(var(--status-error-border))] bg-[hsl(var(--status-error-bg))] text-destructive",
        outline: "border-border bg-background text-foreground",
        warning: "border-[hsl(var(--status-warning-border))] bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]",
        info: "border-[hsl(var(--status-info-border))] bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info))]",
        purple: "border-[hsl(var(--status-purple-border))] bg-[hsl(var(--status-purple-bg))] text-[hsl(var(--status-purple))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
