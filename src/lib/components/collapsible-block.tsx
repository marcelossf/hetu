"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function CollapsibleBlock({
  title,
  defaultOpen = false,
  children,
  className = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl border border-hetu-green/10 bg-white ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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
