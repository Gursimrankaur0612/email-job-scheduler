"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { ChevronDownIcon, LogOutIcon } from "@/components/icons";

export function UserMenu({ user }: { user: Session["user"] }) {
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

  const name = user?.name ?? "Unknown user";
  const email = user?.email ?? "";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:bg-gray-50"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={name} className="h-9 w-9 shrink-0 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{name}</p>
          <p className="truncate text-xs text-gray-500">{email}</p>
        </div>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <LogOutIcon className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
