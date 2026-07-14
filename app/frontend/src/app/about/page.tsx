import type { Metadata } from 'next';
import { Compass, Handshake, Microscope } from 'lucide-react';
import { Navbar } from '@/components/marketing/Navbar';
import { CTASection } from '@/components/marketing/CTASection';
import { Footer } from '@/components/marketing/Footer';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'About — Rasind',
  description:
    'Rasind builds AI tools that help legal teams review contracts, manage risk, and move faster without compromising on accuracy.',
};

const VALUES = [
  {
    icon: Microscope,
    title: 'Accuracy over flash',
    body: 'Legal work has no tolerance for confident nonsense. Every AI output in Rasind is grounded, citable, and designed to be verified — not just believed.',
  },
  {
    icon: Handshake,
    title: 'Lawyers in the loop',
    body: 'We build tools that make good lawyers faster, not tools that pretend to replace them. The attorney always has the final word — and the audit trail proves it.',
  },
  {
    icon: Compass,
    title: 'Trust is the product',
    body: 'Security, confidentiality, and privilege-awareness are not features we bolt on. They shape every architectural decision we make.',
  },
] as const;

export default function AboutPage() {
  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <Navbar />
      <main className="pt-20">
        <section className="relative overflow-hidden py-16 sm:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="marketing-aurora absolute -top-32 left-1/2 h-[26rem] w-[44rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="marketing-grid-bg absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
          </div>
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
              We are building the legal workspace AI was supposed to be
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              Rasind started with a simple observation: legal teams were drowning in routine
              contract work while the tools built to help them were either toys or ten-year
              implementations. We build software that is rigorous enough for lawyers and fast
              enough for the businesses they serve.
            </p>
          </div>
        </section>

        <section className="border-y border-zinc-200/60 bg-zinc-50/50 py-20 dark:border-zinc-800/60 dark:bg-zinc-900/30">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                What we believe
              </h2>
            </Reveal>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {VALUES.map((value, i) => {
                const Icon = value.icon;
                return (
                  <Reveal
                    key={value.title}
                    delay={i * 100}
                    className="rounded-2xl border border-zinc-200/70 bg-white/70 p-7 shadow-sm backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-900/60"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-200/70 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {value.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {value.body}
                    </p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* TODO: add real team section (photos, names, bios) and company milestones
            once provided by the founders. */}

        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
