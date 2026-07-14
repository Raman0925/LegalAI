import type { Metadata } from 'next';
import { Navbar } from '@/components/marketing/Navbar';
import { PricingTable } from '@/components/marketing/PricingTable';
import { CTASection } from '@/components/marketing/CTASection';
import { Footer } from '@/components/marketing/Footer';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Pricing — Rasind',
  description:
    'Simple, transparent pricing for AI contract review. Starter, Team, and Enterprise plans with monthly or annual billing.',
};

const FAQS = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — the Starter plan includes a 14-day free trial with no credit card required. You can upgrade, downgrade, or cancel at any time.',
    // TODO: confirm trial length and terms with the commercial team.
  },
  {
    q: 'How is a “contract” counted?',
    a: 'A contract is a single uploaded document run through AI analysis. Re-analyzing the same document after edits does not count as an additional contract.',
  },
  {
    q: 'Is my data used to train AI models?',
    a: 'No. Customer documents are never used to train models, and you can request full export or deletion of your data at any time.',
  },
  {
    q: 'Do you offer discounts for nonprofits or legal aid?',
    a: 'We offer discounted plans for legal aid organizations, clinics, and nonprofits. Contact us and we will set you up.',
  },
  {
    q: 'What does Enterprise onboarding include?',
    a: 'A dedicated account manager, playbook migration, SSO configuration, security review support, and training sessions for your team.',
  },
] as const;

export default function PricingPage() {
  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <Navbar />
      <main className="pt-20">
        <PricingTable />

        <section aria-labelledby="faq-heading" className="border-t border-zinc-200/60 bg-zinc-50/50 py-20 dark:border-zinc-800/60 dark:bg-zinc-900/30">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal className="text-center">
              <h2
                id="faq-heading"
                className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                Frequently asked questions
              </h2>
            </Reveal>
            <div className="mt-10 space-y-4">
              {FAQS.map((faq, i) => (
                <Reveal key={faq.q} delay={i * 60}>
                  <details className="group rounded-xl border border-zinc-200/70 bg-white/70 p-5 backdrop-blur transition-colors open:border-indigo-300/60 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:open:border-indigo-500/40">
                    <summary className="cursor-pointer list-none text-base font-semibold text-zinc-900 marker:hidden dark:text-zinc-50">
                      {faq.q}
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {faq.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
