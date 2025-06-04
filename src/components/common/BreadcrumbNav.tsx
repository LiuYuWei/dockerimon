
"use client";

import Link from 'next/link';
import React, { type ReactElement } from 'react'; // Added React import
import { ChevronRightIcon } from 'lucide-react'; 
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label?: string;
  icon?: ReactElement;
  href?: string;
  isCurrent?: boolean;
  shortLabel?: string; 
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbNav({ items, className }: BreadcrumbProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("w-full mb-6", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 md:gap-x-2 text-base text-muted-foreground">
        {items.map((item, index) => {
          const isLastItem = index === items.length - 1;
          
          let content;
          if (item.icon) {
            // Clone the icon to apply specific classes for size and color transition.
            // Icons should use `currentColor` for fill/stroke to inherit text color.
            content = React.cloneElement(item.icon, { 
              className: cn("h-5 w-5 shrink-0", item.icon.props?.className) // Added optional chaining for props
            });
          } else {
            content = (
              <>
                <span className="md:hidden text-sm" title={item.label === item.shortLabel || !item.shortLabel ? undefined : item.label}>
                  {item.shortLabel || item.label}
                </span>
                <span className="hidden md:inline text-base">{item.label}</span>
              </>
            );
          }

          return (
            <li key={index} className="flex items-center">
              {item.isCurrent || !item.href ? (
                <span
                  className={cn(
                    "font-normal flex items-center", 
                    item.isCurrent && "font-medium text-foreground text-base md:text-lg" 
                  )}
                  aria-current={item.isCurrent ? "page" : undefined}
                >
                  {content}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="font-normal flex items-center text-muted-foreground hover:text-primary focus:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
                >
                  {content}
                </Link>
              )}

              {!isLastItem && (
                <span className="mx-1 md:mx-1.5" role="presentation">
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
