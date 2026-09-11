"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClockIcon } from "@/components/icons";

interface SchedulePopoverProps {
  scheduledAt: Date | null;
  onSchedule: (date: Date | null) => void;
}

function tomorrowAt(hour: number, minute: number) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toTimeInputValue(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const QUICK_PICKS: { label: string; getDate: () => Date }[] = [
  { label: "Tomorrow", getDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  { label: "Tomorrow, 10:00 AM", getDate: () => tomorrowAt(10, 0) },
  { label: "Tomorrow, 11:00 AM", getDate: () => tomorrowAt(11, 0) },
  { label: "Tomorrow, 3:00 PM", getDate: () => tomorrowAt(15, 0) },
];

export function SchedulePopover({ scheduledAt, onSchedule }: SchedulePopoverProps) {
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState(() => toDateInputValue(scheduledAt ?? new Date()));
  const [timeValue, setTimeValue] = useState(() => toTimeInputValue(scheduledAt ?? new Date()));
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

  function openPopover() {
    const base = scheduledAt ?? new Date();
    setDateValue(toDateInputValue(base));
    setTimeValue(toTimeInputValue(base));
    setOpen(true);
  }

  function handleQuickPick(getDate: () => Date) {
    onSchedule(getDate());
    setOpen(false);
  }

  function handleDone() {
    if (dateValue && timeValue) {
      const [year, month, day] = dateValue.split("-").map(Number);
      const [hour, minute] = timeValue.split(":").map(Number);
      onSchedule(new Date(year, month - 1, day, hour, minute));
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Schedule send time"
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={`rounded-lg border p-2 transition ${
          scheduledAt
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-gray-200 text-gray-500 hover:bg-gray-50"
        }`}
      >
        <CalendarClockIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
            <input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {QUICK_PICKS.map(({ label, getDate }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleQuickPick(getDate)}
                className="rounded-lg px-3 py-1.5 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
