import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileText, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Hero: aurora gradient background, headline, dual CTAs and a floating
 * CSS-built product mockup of the contract-review workspace.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-36 sm:pb-28 sm:pt-44">
      {/* Aurora / gradient mesh background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="marketing-aurora absolute -top-40 left-1/2 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-500/15" />
        <div className="marketing-aurora absolute -top-20 left-1/4 h-[26rem] w-[30rem] rounded-full bg-sky-400/15 blur-3xl [animation-delay:-6s] dark:bg-sky-500/10" />
        <div className="marketing-aurora absolute right-[8%] top-16 h-[22rem] w-[26rem] rounded-full bg-violet-400/15 blur-3xl [animation-delay:-11s] dark:bg-violet-500/10" />
        <div className="marketing-grid-bg absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-6 gap-1.5 border border-indigo-200/60 bg-indigo-50 px-3 py-1 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/10">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            AI built for legal-grade accuracy
          </Badge>

          <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
            Contract review that moves at the speed of{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-400">
              your business
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Rasind analyzes contracts, flags risky clauses, drafts redlines, and answers research
            questions with citations — so your legal team closes deals in hours, not weeks.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
            >
              Book a demo
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white/60 px-6 text-sm font-semibold text-zinc-800 backdrop-blur transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Start free trial
            </Link>
          </div>

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
            No credit card required · SOC 2-ready controls · Your data is never used for training
            {/* TODO: confirm trial terms and data-usage claims with legal/compliance before launch */}
          </p>
        </div>

        {/* Product mockup */}
        <div className="marketing-float relative mx-auto mt-16 max-w-4xl">
          <div
            aria-hidden="true"
            className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-indigo-500/15 via-violet-500/15 to-sky-500/15 blur-2xl"
          />
          <div
            role="img"
            aria-label="Screenshot mockup of the Rasind contract review workspace showing an analyzed agreement with flagged clauses"
            className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 shadow-2xl shadow-zinc-900/10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 hidden rounded-md bg-zinc-200/70 px-3 py-1 text-xs text-zinc-500 sm:block dark:bg-zinc-800 dark:text-zinc-400">
                app.rasind.tech/contracts/msa-acme-2026
              </span>
            </div>

            <div className="grid grid-cols-1 gap-0 sm:grid-cols-5">
              {/* Document pane */}
              <div className="col-span-3 border-b border-zinc-200/80 p-5 text-left sm:border-b-0 sm:border-r dark:border-zinc-800">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  Master Services Agreement — Acme Corp
                </div>
                <div className="mt-4 space-y-2.5">
                  <div className="h-2 w-11/12 rounded bg-zinc-200 dark:bg-zinc-700/70" />
                  <div className="h-2 w-full rounded bg-zinc-200 dark:bg-zinc-700/70" />
                  <div className="h-2 w-4/5 rounded bg-zinc-200 dark:bg-zinc-700/70" />
                  <div className="rounded-md border border-amber-300/70 bg-amber-50 px-2 py-1.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <div className="h-2 w-3/4 rounded bg-amber-300/70 dark:bg-amber-500/40" />
                  </div>
                  <div className="h-2 w-full rounded bg-zinc-200 dark:bg-zinc-700/70" />
                  <div className="h-2 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700/70" />
                  <div className="rounded-md border border-red-300/70 bg-red-50 px-2 py-1.5 dark:border-red-500/30 dark:bg-red-500/10">
                    <div className="h-2 w-5/6 rounded bg-red-300/70 dark:bg-red-500/40" />
                  </div>
                  <div className="h-2 w-10/12 rounded bg-zinc-200 dark:bg-zinc-700/70" />
                  <div className="h-2 w-3/5 rounded bg-zinc-200 dark:bg-zinc-700/70" />
                </div>
              </div>

              {/* AI analysis pane */}
              <div className="col-span-2 p-5 text-left">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  AI Analysis
                </div>
                <ul className="mt-4 space-y-3 text-xs">
                  <li className="flex items-start gap-2 rounded-lg border border-red-200/70 bg-red-50/70 p-2.5 dark:border-red-500/25 dark:bg-red-500/10">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      §9.2 Uncapped liability — deviates from your playbook
                    </span>
                  </li>
                  <li className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/70 p-2.5 dark:border-amber-500/25 dark:bg-amber-500/10">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      §4.1 Auto-renewal term of 24 months — flag for review
                    </span>
                  </li>
                  <li className="flex items-start gap-2 rounded-lg border border-emerald-200/70 bg-emerald-50/70 p-2.5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      §12 Governing law matches standard position
                    </span>
                  </li>
                  <li className="flex items-start gap-2 rounded-lg border border-indigo-200/70 bg-indigo-50/70 p-2.5 dark:border-indigo-500/25 dark:bg-indigo-500/10">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      Suggested redline ready for §9.2 — one click to apply
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
