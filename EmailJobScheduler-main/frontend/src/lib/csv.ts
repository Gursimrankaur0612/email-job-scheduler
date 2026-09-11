import Papa from "papaparse";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parses a recipients CSV client-side. Looks for a header column containing
// "email" (case-insensitive); if no header matches (or the file has no
// header row), falls back to scanning every cell for something email-shaped.
export function parseRecipientsCsv(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? [];
        const emailField = fields.find((f) => /email/i.test(f));

        const emails = new Set<string>();

        if (emailField) {
          for (const row of results.data) {
            const value = row[emailField]?.trim();
            if (value && EMAIL_RE.test(value)) {
              emails.add(value);
            }
          }
        } else {
          // No obvious email column — scan every cell in every row.
          for (const row of results.data) {
            for (const value of Object.values(row)) {
              const trimmed = value?.trim();
              if (trimmed && EMAIL_RE.test(trimmed)) {
                emails.add(trimmed);
              }
            }
          }
        }

        resolve(Array.from(emails));
      },
      error: (error: Error) => reject(error),
    });
  });
}
