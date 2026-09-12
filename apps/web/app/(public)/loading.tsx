import { HERO_STAGE_CLASSNAME } from "@/lib/hero";

export default function PublicLoading() {
  return (
    <div className="overflow-x-hidden">
      <section
        id="home"
        className="relative isolate scroll-mt-20 overflow-hidden bg-background"
        aria-hidden
      >
        <div className={HERO_STAGE_CLASSNAME}>
          <div className="absolute inset-0 bg-muted/40" />
        </div>
      </section>
    </div>
  );
}
