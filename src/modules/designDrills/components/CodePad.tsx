"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import hljs from "highlight.js/lib/core";
import cpp from "highlight.js/lib/languages/cpp";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import { RotateCcw } from "lucide-react";
import {
  getDesignDrillCodeLanguage,
  getServerDesignDrillCodeLanguage,
  setDesignDrillCodeLanguage,
  subscribeDesignDrillCodeLanguage,
  type DesignDrillCodeLanguage,
} from "@/src/modules/designDrills/components/designDrillCodeLanguage";

hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("python", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("go", go);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("java", java);
hljs.registerLanguage("sql", sql);

const languageOptions: {
  value: DesignDrillCodeLanguage;
  label: string;
}[] = [
  { value: "markdown", label: "Markdown" },
  { value: "plaintext", label: "Plain text" },
  { value: "python", label: "Python3" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "go", label: "Go" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
  { value: "sql", label: "SQL" },
];

const textMetrics =
  "p-3 font-mono text-sm leading-6 tracking-normal whitespace-pre";

const INDENT = "  ";

// A plain <textarea> treats Tab as "move focus to the next element", so
// without this a code pad is unusable for actually indenting code. Mirrors
// the common editor convention: an empty selection just inserts an indent at
// the cursor, a selection (single- or multi-line) indents/dedents every line
// it touches instead of replacing the selected text.
function computeIndent(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  dedent: boolean,
): { next: string; start: number; end: number } {
  if (selectionStart === selectionEnd && !dedent) {
    const next = `${current.slice(0, selectionStart)}${INDENT}${current.slice(selectionEnd)}`;
    const cursor = selectionStart + INDENT.length;
    return { next, start: cursor, end: cursor };
  }

  const lineStart = current.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextNewline = current.indexOf(
    "\n",
    Math.max(selectionEnd - 1, lineStart),
  );
  const lineEnd = nextNewline === -1 ? current.length : nextNewline;

  const lines = current.slice(lineStart, lineEnd).split("\n");
  let firstLineDelta = 0;
  const nextLines = lines.map((line, index) => {
    if (dedent) {
      const match = /^ {1,2}/.exec(line);
      if (!match) return line;
      if (index === 0) firstLineDelta = -match[0].length;
      return line.slice(match[0].length);
    }
    if (index === 0) firstLineDelta = INDENT.length;
    return `${INDENT}${line}`;
  });

  const nextBlock = nextLines.join("\n");
  const next = `${current.slice(0, lineStart)}${nextBlock}${current.slice(lineEnd)}`;

  return {
    next,
    start: Math.max(lineStart, selectionStart + firstLineDelta),
    end: lineStart + nextBlock.length,
  };
}

// LeetCode-style auto-indent on Enter: the new line inherits the current
// line's leading whitespace, plus one more level if the line being ended
// opens a block (a trailing `{`/`(`/`[`, or a Python-style trailing `:`).
function computeEnterIndent(
  current: string,
  selectionStart: number,
  selectionEnd: number,
): { next: string; cursor: number } {
  const withoutSelection =
    current.slice(0, selectionStart) + current.slice(selectionEnd);
  const lineStart = withoutSelection.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineBeforeCursor = withoutSelection.slice(lineStart, selectionStart);
  const baseIndent = /^[ \t]*/.exec(lineBeforeCursor)?.[0] ?? "";
  const opensBlock = /[{([:]$/.test(lineBeforeCursor.trim());
  const indent = opensBlock ? `${baseIndent}${INDENT}` : baseIndent;

  const next = `${withoutSelection.slice(0, selectionStart)}\n${indent}${withoutSelection.slice(selectionStart)}`;
  return { next, cursor: selectionStart + 1 + indent.length };
}

// The common "closing bracket snaps back a level" editor behavior: typing
// `}`/`)`/`]` as the only (whitespace) content so far on the line dedents by
// one level before inserting it, rather than leaving the bracket over-indented.
function computeClosingBracketDedent(
  current: string,
  cursor: number,
  bracket: string,
): { next: string; cursor: number } | null {
  const lineStart = current.lastIndexOf("\n", cursor - 1) + 1;
  const beforeCursor = current.slice(lineStart, cursor);
  if (beforeCursor.length < INDENT.length || /\S/.test(beforeCursor)) {
    return null;
  }
  const dedented = beforeCursor.slice(0, beforeCursor.length - INDENT.length);
  const next = `${current.slice(0, lineStart)}${dedented}${bracket}${current.slice(cursor)}`;
  return { next, cursor: lineStart + dedented.length + 1 };
}

function computeBackspaceDedent(
  current: string,
  cursor: number,
): { next: string; cursor: number } | null {
  const lineStart = current.lastIndexOf("\n", cursor - 1) + 1;
  const nextNewline = current.indexOf("\n", cursor);
  const lineEnd = nextNewline === -1 ? current.length : nextNewline;
  const line = current.slice(lineStart, lineEnd);
  const beforeCursor = current.slice(lineStart, cursor);
  if (/\S/.test(line) || !beforeCursor.endsWith(INDENT)) return null;

  const nextCursor = cursor - INDENT.length;
  const next = `${current.slice(0, nextCursor)}${current.slice(cursor)}`;
  return { next, cursor: nextCursor };
}

interface CodePadProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Clears the scratchpad back to its starting-empty state. Omit to hide the reset button. */
  onReset?: () => void;
  placeholder?: string;
  /** Label shown in the pad's own header bar (replaces a separate wrapping card + heading). */
  label?: string;
  /** Save-status indicator (or any other status node) rendered in the header, left of the controls. */
  status?: ReactNode;
  className?: string;
}

export function CodePad({
  id,
  value,
  onChange,
  onReset,
  placeholder,
  label,
  status,
  className,
}: CodePadProps) {
  const language = useSyncExternalStore(
    subscribeDesignDrillCodeLanguage,
    getDesignDrillCodeLanguage,
    getServerDesignDrillCodeLanguage,
  );
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const highlighted = useMemo(
    () => hljs.highlight(`${value}\n`, { language }).value,
    [language, value],
  );
  const lineCount = value.split("\n").length;

  // Setting selectionRange has to wait until the controlled textarea has
  // actually re-rendered with the new value, or the browser clamps it to the
  // pre-edit content length.
  useEffect(() => {
    if (!pendingSelection.current || !textareaRef.current) return;
    const { start, end } = pendingSelection.current;
    textareaRef.current.setSelectionRange(start, end);
    pendingSelection.current = null;
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const { selectionStart, selectionEnd } = event.currentTarget;

    if (event.key === "Tab") {
      event.preventDefault();
      const { next, start, end } = computeIndent(
        value,
        selectionStart,
        selectionEnd,
        event.shiftKey,
      );
      pendingSelection.current = { start, end };
      onChange(next);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const { next, cursor } = computeEnterIndent(
        value,
        selectionStart,
        selectionEnd,
      );
      pendingSelection.current = { start: cursor, end: cursor };
      onChange(next);
      return;
    }

    if (event.key === "Backspace" && selectionStart === selectionEnd) {
      const dedented = computeBackspaceDedent(value, selectionStart);
      if (dedented) {
        event.preventDefault();
        pendingSelection.current = {
          start: dedented.cursor,
          end: dedented.cursor,
        };
        onChange(dedented.next);
        return;
      }
    }

    if (
      (event.key === "}" || event.key === ")" || event.key === "]") &&
      selectionStart === selectionEnd
    ) {
      const dedented = computeClosingBracketDedent(
        value,
        selectionStart,
        event.key,
      );
      if (dedented) {
        event.preventDefault();
        pendingSelection.current = {
          start: dedented.cursor,
          end: dedented.cursor,
        };
        onChange(dedented.next);
      }
    }
  }

  function handleScroll(event: UIEvent<HTMLTextAreaElement>) {
    const { scrollLeft, scrollTop } = event.currentTarget;
    if (preRef.current) {
      preRef.current.scrollLeft = scrollLeft;
      preRef.current.scrollTop = scrollTop;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollLeft = scrollLeft;
      gutterRef.current.scrollTop = scrollTop;
    }
  }

  function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    setDesignDrillCodeLanguage(
      event.currentTarget.value as DesignDrillCodeLanguage,
    );
  }

  function handleReset() {
    if (!onReset) return;
    if (
      value.trim() &&
      !window.confirm("Reset the scratchpad? This clears what you've written.")
    ) {
      return;
    }
    onReset();
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface focus-within:border-accent ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-subtle px-3 py-1.5">
        {label ? (
          <span className="text-xs font-medium text-body">{label}</span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {status}
          <select
            aria-label="Code language"
            className="h-7 rounded-md border border-input bg-surface px-2 text-xs text-foreground outline-none focus:border-accent"
            id={`${id}-language`}
            onChange={handleLanguageChange}
            value={language}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {onReset ? (
            <button
              aria-label="Reset to default"
              className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-body"
              onClick={handleReset}
              title="Reset to default"
              type="button"
            >
              <RotateCcw aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="code-pad relative min-h-80 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className={`${textMetrics} absolute inset-y-0 left-0 w-12 overflow-hidden border-r border-border bg-surface-subtle text-right text-muted tabular-nums select-none`}
          ref={gutterRef}
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <span className="code-pad-line-number block" key={index}>
              {index + 1}
            </span>
          ))}
        </div>

        <div className="relative ml-12 h-full min-h-80">
          <pre
            aria-hidden="true"
            className={`${textMetrics} pointer-events-none absolute inset-0 m-0 overflow-hidden text-body`}
            ref={preRef}
          >
            <code
              className={`hljs language-${language}`}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </pre>
          <textarea
            autoCapitalize="off"
            autoCorrect="off"
            className={`${textMetrics} relative z-10 h-full min-h-80 w-full resize-none overflow-auto bg-transparent text-transparent outline-none placeholder:text-subtle`}
            id={id}
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            placeholder={placeholder}
            ref={textareaRef}
            spellCheck={false}
            style={{ caretColor: "var(--foreground)" }}
            value={value}
          />
        </div>
      </div>
    </div>
  );
}
