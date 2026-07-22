"use client";

import {
  type ChangeEvent,
  type UIEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import hljs from "highlight.js/lib/core";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
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
hljs.registerLanguage("java", java);
hljs.registerLanguage("sql", sql);

const languageOptions: {
  value: DesignDrillCodeLanguage;
  label: string;
}[] = [
  { value: "markdown", label: "Markdown" },
  { value: "plaintext", label: "Plain text" },
  { value: "python", label: "Python" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "sql", label: "SQL" },
];

const textMetrics =
  "p-3 font-mono text-sm leading-6 tracking-normal whitespace-pre";

interface CodePadProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CodePad({ id, value, onChange, placeholder }: CodePadProps) {
  const language = useSyncExternalStore(
    subscribeDesignDrillCodeLanguage,
    getDesignDrillCodeLanguage,
    getServerDesignDrillCodeLanguage,
  );
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlighted = useMemo(
    () => hljs.highlight(`${value}\n`, { language }).value,
    [language, value],
  );
  const lineCount = value.split("\n").length;

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

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-2">
        <label className="text-xs text-muted" htmlFor={`${id}-language`}>
          Code language
        </label>
        <select
          className="h-8 rounded-md border border-input bg-surface px-2 text-xs text-foreground outline-none focus:border-accent"
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
      </div>

      <div className="code-pad relative min-h-80 overflow-hidden rounded-md border border-input bg-surface focus-within:border-accent">
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

        <div className="relative ml-12 min-h-80">
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
            className={`${textMetrics} relative z-10 min-h-80 w-full resize-y overflow-auto bg-transparent text-transparent outline-none placeholder:text-subtle`}
            id={id}
            onChange={(event) => onChange(event.currentTarget.value)}
            onScroll={handleScroll}
            placeholder={placeholder}
            spellCheck={false}
            style={{ caretColor: "var(--foreground)" }}
            value={value}
          />
        </div>
      </div>
    </div>
  );
}
