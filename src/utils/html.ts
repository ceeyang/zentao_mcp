/**
 * Convert ZenTao HTML steps to plain text for AI consumption.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";

  let text = html;
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export function pickAccount(
  value: unknown,
): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value || null;
  if (typeof value === "object" && value !== null && "account" in value) {
    const account = (value as { account?: string }).account;
    return account || null;
  }
  return null;
}

export function pickStatus(value: unknown): string {
  if (value == null) return "unknown";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "code" in value) {
    return String((value as { code?: string }).code ?? "unknown");
  }
  return String(value);
}
