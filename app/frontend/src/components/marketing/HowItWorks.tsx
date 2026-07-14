import { FileDown, ScanSearch, SquarePen, Upload } from 'lucide-react';
import { Reveal } from './Reveal';
import { Counter } from './Counter';

const STEPS = [
  {
    icon: Upload,
    title: 'Upload',
    description: 'Drag in contracts as Word or PDF — Rasind ingests and structures them instantly.',
  },
  {
    icon: ScanSearch,
    title: 'AI analysis',
    description:
      'Every clause is classified, scored against your playbook, and flagged with plain-English explanations.',
  },
  {
    icon: SquarePen,
    title: 'Review & redline',
    description:
      'Accept, edit, or reject suggested redlines in a collaborative editor with full tracked changes.',
  },
  {
    icon: FileDown,
    title: 'Export & sign',
    description:
      'Send a clean or redlined version back to counterparties, or route it straight to e-signature.',
  },
] as const;

// TODO: replace placeholder stats with real, verifiable product metrics before launch.
const STATS = [
  { value: 10000, suffix: '+', label: 'Contracts reviewed' },
  { value: 85, suffix: '%', label: 'Faster first-pass review' },
  { value: 40, suffix: '+', label: 'Clause types detected' },
  { value: 99, suffix: '.9%', label: 'Uptime SLA' },
] as const;

/**
 * Four-step process with scroll-triggered stagger, followed by an animated
 * stats bar with count-up numbers.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-y border-zinc-200/60 bg-zinc-50/50 py-20 sm:py-28 dark:border-zinc-800/60 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            How it works
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            From inbox to signature in four steps
          </h2>
        </Reveal>

        <ol className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal as="li" key={step.title} delay={i * 120} className="relative">
                {/* connector line (desktop) */}
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute left-[calc(50%+2.5rem)] top-7 hidden h-px w-[calc(100%-5rem)] bg-gradient-to-r from-indigo-300/70 to-transparent lg:block dark:from-indigo-500/30"
                  />
                )}
                <div className="flex flex-col items-center text-center">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-200/70 bg-white text-indigo-600 shadow-sm dark:border-indigo-500/30 dark:bg-zinc-900 dark:text-indigo-400">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>

        {/* Stats */}
        <Reveal className="mt-16">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-200/70 shadow-sm lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1 bg-white/80 px-4 py-8 backdrop-blur dark:bg-zinc-900/80"
              >
                <dd className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  <Counter value={stat.value} suffix={stat.suffix} />
                </dd>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
