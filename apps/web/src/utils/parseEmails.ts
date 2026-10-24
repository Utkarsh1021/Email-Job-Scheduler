const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function parseEmailList(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

export async function parseEmailFile(file: File): Promise<string[]> {
  const text = await file.text();
  return parseEmailList(text);
}
