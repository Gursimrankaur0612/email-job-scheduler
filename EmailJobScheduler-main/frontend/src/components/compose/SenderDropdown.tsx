"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import type { Sender } from "@/lib/senders";

interface SenderDropdownProps {
  senders: Sender[];
  loading: boolean;
  value: string | null;
  onChange: (senderId: string) => void;
}

export function SenderDropdown({ senders, loading, value, onChange }: SenderDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = senders.find((s) => s.id === value);
  const label = loading ? "Loading senders…" : (selected?.email ?? "Select a sender");

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        disabled={loading || senders.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && senders.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {senders.map((sender) => (
            <button
              key={sender.id}
              type="button"
              onClick={() => {
                onChange(sender.id);
                setOpen(false);
              }}
              className={`flex w-full flex-col px-4 py-2 text-left text-sm transition hover:bg-gray-50 ${
                sender.id === value ? "bg-green-50" : ""
              }`}
            >
              <span className="font-medium text-gray-900">{sender.displayName}</span>
              <span className="text-xs text-gray-500">{sender.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
