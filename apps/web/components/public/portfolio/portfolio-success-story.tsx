"use client";

function splitStoryBlocks(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseBlock(block: string) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const heading = lines[0] || "";
  const body = lines.slice(1).join("\n").trim();
  const looksLikeHeading =
    Boolean(body) && heading.length <= 48 && !/[.!?؟]$/.test(heading);
  if (looksLikeHeading) {
    return { heading, body };
  }
  return { heading: null, body: block };
}

export function PortfolioSuccessStory({ text }: { text: string }) {
  const blocks = splitStoryBlocks(text);
  if (!blocks.length) return null;

  return (
    <section
      aria-labelledby="portfolio-success-story"
      className="mt-6 max-w-3xl"
    >
      <h2
        id="portfolio-success-story"
        className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
      >
        داستان موفقیت
      </h2>
      <div className="mt-4 space-y-5">
        {blocks.map((block, index) => {
          const parsed = parseBlock(block);
          if (parsed.heading) {
            return (
              <div key={`${parsed.heading}-${index}`}>
                <h3 className="text-sm font-semibold text-foreground">
                  {parsed.heading}
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap text-pretty text-sm leading-8 text-muted-foreground sm:text-base sm:leading-8">
                  {parsed.body}
                </p>
              </div>
            );
          }
          return (
            <p
              key={index}
              className="whitespace-pre-wrap text-pretty text-sm leading-8 text-muted-foreground sm:text-base sm:leading-8"
            >
              {parsed.body}
            </p>
          );
        })}
      </div>
    </section>
  );
}
