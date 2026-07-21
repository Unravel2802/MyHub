import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/src/lib/cn";

interface MarkdownProps {
  children: string;
  className?: string;
}

// Shared, XSS-safe GFM renderer. Deliberately NOT wired to `rehype-raw`: the
// markdown we render comes from our own DB, but rendering raw embedded HTML from
// a text column is exactly the injection path we refuse to open, so react-
// markdown's default (raw HTML is skipped, never parsed) is the whole point.
// There is intentionally no `@tailwindcss/typography`/`prose` in this app, so
// every element is mapped onto the existing semantic tokens by hand below.
//
// `rehype-highlight` adds `.hljs` token classes to fenced code; the theme that
// paints them (and the inline-vs-block reset) lives in app/globals.css under
// `.md-content`.

// External links open in a new tab and are hardened against reverse-tabnabbing;
// in-page anchors (a section deep-link, `#detailed-design`) stay in place.
function MarkdownLink({ href, ...props }: ComponentPropsWithoutRef<"a">) {
  const isInternalAnchor = href?.startsWith("#");
  return (
    <a
      className="font-medium text-accent-strong underline underline-offset-2 hover:text-accent"
      href={href}
      {...(isInternalAnchor
        ? {}
        : { rel: "noopener noreferrer", target: "_blank" })}
      {...props}
    />
  );
}

// One home for the element→token mapping. Block elements carry their own top
// margin with `first:mt-0`, rather than a container `space-y-*`, so headings can
// take a larger gap than paragraphs without the two rules fighting.
const components = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="mt-6 text-lg font-semibold tracking-tight text-foreground first:mt-0"
      {...props}
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-6 text-base font-semibold tracking-tight text-foreground first:mt-0"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="mt-5 text-sm font-semibold text-foreground first:mt-0"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="mt-3 leading-relaxed text-body first:mt-0" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="mt-3 list-disc space-y-1 pl-5 text-body marker:text-muted first:mt-0"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="mt-3 list-decimal space-y-1 pl-5 text-body marker:text-muted first:mt-0"
      {...props}
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-relaxed" {...props} />
  ),
  a: MarkdownLink,
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    // Inline pill styling; `.md-content pre code` resets it back for fenced
    // blocks (see globals.css) so block code isn't wrapped in a pill.
    <code
      className="rounded bg-surface-subtle px-1 py-0.5 font-mono text-[0.85em] text-foreground"
      {...props}
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-subtle p-3 font-mono text-xs leading-relaxed first:mt-0"
      {...props}
    />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="mt-3 border-l-2 border-accent-border pl-3 italic text-body first:mt-0"
      {...props}
    />
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr className="my-4 border-border" {...props} />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="mt-3 overflow-x-auto first:mt-0">
      <table className="w-full border-collapse text-left" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="border border-border bg-surface-subtle px-3 py-1.5 font-semibold text-foreground"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td
      className="border border-border px-3 py-1.5 align-top text-body"
      {...props}
    />
  ),
};

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("md-content text-sm text-body", className)}>
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeHighlight]}
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
