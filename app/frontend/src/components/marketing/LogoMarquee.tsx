/**
 * Trust bar: looping logo marquee with fade-edge mask.
 *
 * TODO: replace placeholder wordmarks with real client/partner logo SVGs
 * (and written permission to use them) before launch.
 */
const PLACEHOLDER_LOGOS = [
  'Meridian & Cole LLP',
  'Northgate Legal',
  'Atlas Ventures',
  'Hartwell Group',
  'Calder & Finch',
  'Bluestone Partners',
  'Veritas Counsel',
  'Oakline Industries',
] as const;

export function LogoMarquee() {
  const logos = [...PLACEHOLDER_LOGOS, ...PLACEHOLDER_LOGOS];

  return (
    <section aria-label="Trusted by legal teams" className="border-y border-zinc-200/60 bg-zinc-50/50 py-10 dark:border-zinc-800/60 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
          Trusted by in-house teams and firms of every size
        </p>
        <div className="marketing-marquee-container marketing-fade-mask mt-6 overflow-hidden">
          <ul className="marketing-marquee flex w-max items-center gap-14" aria-hidden="false">
            {logos.map((name, i) => (
              <li
                key={`${name}-${i}`}
                aria-hidden={i >= PLACEHOLDER_LOGOS.length}
                className="whitespace-nowrap font-serif text-lg font-semibold tracking-tight text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
