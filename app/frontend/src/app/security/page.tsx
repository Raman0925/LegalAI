import type { Metadata } from 'next';
import { FileCheck2, KeyRound, Landmark, ShieldAlert } from 'lucide-react';
import { Navbar } from '@/components/marketing/Navbar';
import { SecurityBadges } from '@/components/marketing/SecurityBadges';
import { CTASection } from '@/components/marketing/CTASection';
import { Footer } from '@/components/marketing/Footer';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Security & Compliance — Rasind',
  description:
    'How Rasind protects privileged legal documents: encryption, access controls, audit logging, data residency, and compliance certifications.',
};

/**
 * TODO: this entire page needs review by the compliance/security team before
 * launch — certification claims, subprocessor list, and policy links must be
 * verified and real documents (security whitepaper, DPA) linked.
 */
const PRACTICES = [
  {
    icon: KeyRound,
    title: 'Access & authentication',
    body: 'SAML/OIDC single sign-on, enforced MFA, SCIM provisioning, and role-based permissions down to individual matters. Sessions are short-lived and revocable by admins in real time.',
  },
  {
    icon: FileCheck2,
    title: 'Data handling',
    body: 'Documents are encrypted with AES-256 at rest and TLS 1.2+ in transit. Customer content is logically isolated per tenant, never used for model training, and fully exportable or deletable on request.',
  },
  {
    icon: ShieldAlert,
    title: 'Monitoring & response',
    body: 'Continuous vulnerability scanning, annual third-party penetration tests, and a documented incident-response plan with customer notification commitments.',
  },
  {
    icon: Landmark,
    title: 'Legal & privacy',
    body: 'GDPR-ready data processing agreements, regional data residency (US/EU), and support for outside-counsel guidelines and information-barrier requirements.',
  },
] as const;

export default function SecurityPage() {
  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <Navbar />
      <main className="pt-20">
        <section className="relative overflow-hidden py-16 sm:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="marketing-aurora absolute -top-32 left-1/2 h-[26rem] w-[44rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="marketing-grid-bg absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
          </div>
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
              Security you can put in front of your own security team
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-zinc-600 dark:text-zinc-400">
              Legal documents are among the most sensitive data a company holds. Here is exactly
              how we protect them.
            </p>
          </div>
        </section>

        <SecurityBadges showLink={false} />

        <section className="border-t border-zinc-200/60 bg-zinc-50/50 py-20 dark:border-zinc-800/60 dark:bg-zinc-900/30">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Our security practices in depth
              </h2>
            </Reveal>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              {PRACTICES.map((practice, i) => {
                const Icon = practice.icon;
                return (
                  <Reveal
                    key={practice.title}
                    delay={(i % 2) * 100}
                    className="rounded-2xl border border-zinc-200/70 bg-white/70 p-7 shadow-sm backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-900/60"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200/70 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {practice.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {practice.body}
                    </p>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="mt-12 rounded-2xl border border-indigo-200/60 bg-indigo-50/60 p-6 text-center text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
              Need our security whitepaper, DPA, or a completed vendor questionnaire?{' '}
              {/* TODO: link real documents once available */}
              Email{' '}
              <a href="mailto:security@rasind.tech" className="font-semibold underline underline-offset-2">
                security@rasind.tech
              </a>{' '}
              and we will get them to you within one business day.
            </Reveal>
          </div>
        </section>

        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
