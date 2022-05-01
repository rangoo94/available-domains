export function extractWords(text: string): string[] {
  // Detect possible domain segments from text
  const wordRegex = /(?:^|[^a-z0-9])(?:\.?[a-z0-9-]+)+/gi;
  return Array.from(text.match(wordRegex) || []);
}
