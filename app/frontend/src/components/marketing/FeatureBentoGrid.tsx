import {
  BookOpenText,
  FileSearch,
  FileSignature,
  Library,
  PenLine,
  Users,
} from 'lucide-react';
import { Reveal } from './Reveal';
import { cn } from '@/lib/utils';

interface Feature {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  title: string;
  description: string;
  /** Extra grid classes for the bento layout. */
  span?: string;
}

const FEATURES: Feature[] = [
  {
    icon: FileSearch,
    title: 'AI contract review',
    description:
      'Upload any contract and get a clause-by-clause risk analysis in minutes, benchmarked against your playbook and market standards.',
    span: 'md:col-span-2',
  },
  {
    icon: Library,
    title: 'Clause library',
    description:
      'A living library of your approved positions and fallbacks, so every negotiation starts from precedent, not a blank page.',
  },
  {
    icon: PenLine,
    title: 'One-click redlining',
    description:
      'Accept AI-suggested redlines directly in the editor, with tracked changes your counterparty can open in Word.',
  },
  {
    icon: BookOpenText,
    title: 'Legal research with citations',
    description:
      'Ask questions in plain English and get answers grounded in your documents and sources — every claim cited, every citation checkable.',
    span: 'md:col-span-2',
  },
  {
    icon: Users,
    title: 'Team collaboration',
    description:
      'Comment, assign, and approve in one workspace with a full audit trail of who changed what and when.',
  },
  {
    icon: FileSignature,
    title: 'Export & e-signature',
    description:
      'Export clean or redlined versions to Word and PDF, and route final documents for signature without leaving Rasind.',
  },
];

/**
 * Bento grid of core capabilities. Glass cards with an icon, hover glow and
 * a subtle lift micro-animation.
 */
export function FeatureBentoGrid() {
  return (
    <section id="features" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Capabilities
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Everything your legal team needs, in one workspace
          </h2>
          <p className="mt-4 text-pretty text-zinc-600 dark:text-zinc-400">
            From first draft to final signature, Rasind covers the full contract lifecycle with
            AI that understands legal language.
          </p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal
                as="li"
                key={feature.title}
                delay={(i % 3) * 90}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/60 p-6 shadow-sm backdrop-blur transition-all duration-300',
                  'hover:-translate-y-1 hover:border-indigo-300/60 hover:shadow-lg hover:shadow-indigo-500/10',
                  'dark:border-zinc-800/70 dark:bg-zinc-900/50 dark:hover:border-indigo-500/40',
                  feature.span,
                )}
              >
                {/* hover glow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-indigo-500/0 blur-3xl transition-colors duration-500 group-hover:bg-indigo-500/15"
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-200/70 bg-indigo-50 text-indigo-600 transition-transform duration-300 group-hover:scale-110 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
