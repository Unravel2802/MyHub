import { Markdown } from "@/src/components/ui/Markdown";
import { Panel } from "@/src/components/ui/Panel";

interface TradingReferenceLibraryProps {
  systematicPlan: string;
  technicalDeepDive: string;
}

interface DeepDiveChapter {
  id: string;
  label: string;
  markdown: string;
}

function chapterId(number: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `technical-${number}-${slug}`;
}

function splitDeepDive(markdown: string): {
  introduction: string;
  chapters: DeepDiveChapter[];
} {
  const matches = [...markdown.matchAll(/^## (\d{2}) · (.+)$/gm)];
  const firstChapterAt = matches[0]?.index ?? markdown.length;
  const introduction = markdown.slice(0, firstChapterAt).trim();
  const chapters = matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? markdown.length;
    const number = match[1];
    const title = match[2].trim();
    return {
      id: chapterId(number, title),
      label: `${number} · ${title}`,
      markdown: markdown.slice(start, end).trim(),
    };
  });

  return { introduction, chapters };
}

export function TradingReferenceLibrary({
  systematicPlan,
  technicalDeepDive,
}: TradingReferenceLibraryProps) {
  const deepDive = splitDeepDive(technicalDeepDive);

  return (
    <div className="grid min-w-0 gap-6">
      <Panel
        description="Strategy framing, signal generator, broker setup, and the milestone-based capital ladder."
        title="Systematic Trading Plan"
      >
        <Markdown>{systematicPlan}</Markdown>
      </Panel>

      <Panel
        description="The math, market structure, risk discipline, and Python behind the system."
        title="Technical Deep Dive"
      >
        {deepDive.introduction ? (
          <Markdown>{deepDive.introduction}</Markdown>
        ) : null}

        <nav
          aria-label="Technical deep dive chapters"
          className="mt-5 rounded-md border border-border bg-surface-subtle p-4"
        >
          <p className="text-sm font-semibold text-foreground">
            Table of contents
          </p>
          <ol className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {deepDive.chapters.map((chapter) => (
              <li key={chapter.id}>
                <a
                  className="text-sm font-medium text-accent-strong underline-offset-2 hover:text-accent hover:underline"
                  href={`#${chapter.id}`}
                >
                  {chapter.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 grid gap-8">
          {deepDive.chapters.map((chapter) => (
            <section className="scroll-mt-6" id={chapter.id} key={chapter.id}>
              <Markdown>{chapter.markdown}</Markdown>
            </section>
          ))}
        </div>
      </Panel>
    </div>
  );
}
