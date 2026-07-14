'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Reveal } from './Reveal';
import { cn } from '@/lib/utils';

/**
 * TODO: replace with real customer quotes (with written approval) before
 * launch. These are illustrative placeholders.
 */
const TESTIMONIALS = [
  {
    quote:
      'Rasind cut our NDA turnaround from three days to under an hour. The playbook flags catch things even experienced reviewers miss at 6pm on a Friday.',
    name: 'Placeholder — General Counsel',
    role: 'Mid-market SaaS company',
  },
  {
    quote:
      'The citations are what won us over. Every research answer links back to a source we can verify — that is the difference between a demo trick and a tool we trust.',
    name: 'Placeholder — Legal Operations Director',
    role: 'Fortune 500 enterprise',
  },
  {
    quote:
      'Our associates now start from an AI first pass instead of a blank page. Partners review higher-quality drafts, and clients see the difference in the bill.',
    name: 'Placeholder — Managing Partner',
    role: 'AmLaw 200 firm',
  },
] as const;

/**
 * Accessible testimonial carousel: previous/next buttons, dot indicators,
 * keyboard operable, announces slide changes politely.
 */
export function TestimonialCarousel() {
  const [index, setIndex] = React.useState(0);
  const count = TESTIMONIALS.length;

  const go = (next: number) => setIndex(((next % count) + count) % count);
  const active = TESTIMONIALS[index];

  return (
    <section id="testimonials" className="scroll-mt-24 border-y border-zinc-200/60 bg-zinc-50/50 py-20 sm:py-28 dark:border-zinc-800/60 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Testimonials
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Trusted by the people who read the fine print
          </h2>
        </Reveal>

        <Reveal className="mt-12">
          <div
            role="group"
            aria-roledescription="carousel"
            aria-label="Customer testimonials"
            className="relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm backdrop-blur sm:p-12 dark:border-zinc-800/70 dark:bg-zinc-900/60"
          >
            <Quote
              className="absolute left-6 top-6 h-8 w-8 text-indigo-200 dark:text-indigo-500/30"
              aria-hidden="true"
            />
            <div aria-live="polite" className="relative min-h-[10rem] sm:min-h-[8rem]">
              <blockquote className="text-pretty text-lg leading-relaxed text-zinc-800 sm:text-xl dark:text-zinc-200">
                “{active.quote}”
              </blockquote>
              <footer className="mt-6">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">{active.name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{active.role}</p>
              </footer>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div className="flex gap-2" role="tablist" aria-label="Choose testimonial">
                {TESTIMONIALS.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Testimonial ${i + 1} of ${count}`}
                    onClick={() => go(i)}
                    className={cn(
                      'h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
                      i === index
                        ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                        : 'w-2.5 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600',
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  aria-label="Previous testimonial"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  aria-label="Next testimonial"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
