"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  children: ReactNode;
  className?: string;
};

export function CollapsibleBlock({
  title,
  defaultOpen = false,
  open,
  onOpenChange,
  id,
  children,
  className = "",
}: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  function setOpen(nextOpen: boolean) {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <div
      id={id}
      className={`scroll-mt-6 rounded-xl border border-hetu-green/10 bg-white ${className}`}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 sm:px-6 hover:bg-hetu-cream/40 transition"
      >
        <h2 className="font-medium text-hetu-green">{title}</h2>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-hetu-green transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="border-t border-hetu-green/10 px-5 py-4 sm:px-6">
          {children}
        </div>
      )}
    </div>
  );
}
