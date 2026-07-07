export function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createChapterStarterText(title: string): string {
  return `${normalizeLineEndings(title).trim()}\n\n`;
}

export function normalizeLegacyChapterText(value: string): string {
  const normalized = normalizeLineEndings(value);
  if (!normalized.includes("<")) return normalized;

  let result = "";
  let tag = "";
  let insideTag = false;

  for (const character of normalized) {
    if (character === "<") {
      insideTag = true;
      tag = "";
      continue;
    }
    if (character === ">" && insideTag) {
      const name = tag.trim().toLowerCase();
      if (
        name.startsWith("br") ||
        name === "/p" ||
        name === "/div" ||
        name === "/li" ||
        name.startsWith("/h")
      ) {
        result += "\n";
      } else if (name === "li" || name.startsWith("li ")) {
        result += "- ";
      }
      insideTag = false;
      tag = "";
      continue;
    }
    if (insideTag) tag += character;
    else result += character;
  }

  if (insideTag) result += `<${tag}`;

  return decodeCommonEntities(result)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function decodeCommonEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
