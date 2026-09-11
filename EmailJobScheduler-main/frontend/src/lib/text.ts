// Strips HTML tags for use as plain-text preview text (email bodies are
// stored as the rich-text editor's HTML output).
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
