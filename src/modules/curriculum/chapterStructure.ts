export interface OutlineEntry {
  id: string;
  text: string;
  number: number;
  line: number;
}

function fencedLines(markdown: string): boolean[] {
  const inside: boolean[] = [];
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    inside.push(fenced);
    if (/^\s*```/.test(line)) fenced = !fenced;
  }
  return inside;
}

export function splitTakeaways(body: string): {
  main: string;
  takeaways: string | null;
} {
  const lines = body.split(/\r?\n/);
  const fenced = fencedLines(body);
  let at = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (!fenced[i] && /^##\s+What to take away\s*$/i.test(lines[i])) {
      at = i;
      break;
    }
  }
  if (at === -1) return { main: body, takeaways: null };
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i += 1) {
    if (!fenced[i] && /^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return {
    main: [...lines.slice(0, at), ...lines.slice(end)].join("\n").trim(),
    takeaways: lines
      .slice(at + 1, end)
      .join("\n")
      .trim(),
  };
}

export function slugifyHeading(text: string, taken: Set<string>): string {
  const plain =
    text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  let id = plain;
  let suffix = 2;
  while (taken.has(id)) id = `${plain}-${suffix++}`;
  taken.add(id);
  return id;
}

export function chapterOutline(markdown: string): OutlineEntry[] {
  const lines = markdown.split(/\r?\n/);
  const fenced = fencedLines(markdown);
  const taken = new Set<string>();
  return lines.flatMap((line, index) => {
    const match = /^(##)\s+(.+?)\s*$/.exec(line);
    if (!match || fenced[index]) return [];
    return [
      {
        id: slugifyHeading(match[2], taken),
        text: match[2],
        number: taken.size,
        line: index + 1,
      },
    ];
  });
}
