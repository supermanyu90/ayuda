// Helpers for passing untrusted text (user requests, voice transcripts,
// organisation descriptions) to the model as *data*, never as instructions.

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

/** Strip control / bidi characters, collapse whitespace, cap length. */
export function cleanUntrusted(text: string, maxLen = 600): string {
  return text.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/**
 * Wrap untrusted text in delimiters the content cannot forge: any delimiter-like
 * sequence inside the text is neutralised first.
 */
export function fence(label: string, text: string, maxLen?: number): string {
  const safe = cleanUntrusted(text, maxLen).replace(/<{2,}|>{2,}/g, ' ');
  return `<<${label}>>\n${safe}\n<</${label}>>`;
}

/** Parse the first JSON object in a model reply (tolerates ```json fences). Throws on anything else. */
export function parseModelJson(raw: string): unknown {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end <= start) throw new SyntaxError('no JSON object in model output');
  const value: unknown = JSON.parse(stripped.slice(start, end + 1));
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError('model output is not a JSON object');
  return value;
}
