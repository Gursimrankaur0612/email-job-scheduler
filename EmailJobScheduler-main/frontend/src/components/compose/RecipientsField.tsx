"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { UploadIcon, XIcon } from "@/components/icons";
import { parseRecipientsCsv } from "@/lib/csv";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VISIBLE_CHIPS = 3;

interface RecipientsFieldProps {
  recipients: string[];
  onChange: (recipients: string[]) => void;
}

export function RecipientsField({ recipients, onChange }: RecipientsFieldProps) {
  const [inputValue, setInputValue] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addRecipients(candidates: string[]) {
    const next = new Set(recipients);
    for (const candidate of candidates) {
      const trimmed = candidate.trim();
      if (trimmed && EMAIL_RE.test(trimmed)) {
        next.add(trimmed);
      }
    }
    onChange(Array.from(next));
  }

  function removeRecipient(email: string) {
    onChange(recipients.filter((r) => r !== email));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addRecipients([inputValue]);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && inputValue === "" && recipients.length > 0) {
      removeRecipient(recipients[recipients.length - 1]);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setParsing(true);
    try {
      const emails = await parseRecipientsCsv(file);
      addRecipients(emails);
    } finally {
      setParsing(false);
    }
  }

  const visibleChips = recipients.slice(0, VISIBLE_CHIPS);
  const overflowCount = recipients.length - visibleChips.length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500">To</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing}
          className="flex items-center gap-1.5 text-sm font-medium text-green-600 transition hover:text-green-700 disabled:opacity-60"
        >
          <UploadIcon className="h-4 w-4" />
          {parsing ? "Parsing…" : "Upload List"}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      </div>

      <div className="mt-1.5 flex min-h-[3rem] flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        {visibleChips.map((email) => (
          <span
            key={email}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200"
          >
            {email}
            <button
              type="button"
              aria-label={`Remove ${email}`}
              onClick={() => removeRecipient(email)}
              className="text-gray-400 transition hover:text-gray-600"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}

        {overflowCount > 0 && (
          <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-600">
            +{overflowCount}
          </span>
        )}

        <input
          type="email"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={recipients.length === 0 ? "Enter an email and press Enter, or upload a CSV" : ""}
          className="min-w-[10rem] flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      {recipients.length > 0 && (
        <p className="mt-1.5 text-xs text-gray-500">{recipients.length} recipients detected</p>
      )}
    </div>
  );
}
