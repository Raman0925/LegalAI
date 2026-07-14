import Link from 'next/link';
import { ArrowRight, FileKey2, Globe2, Lock, ServerCog, ShieldCheck, UserCheck } from 'lucide-react';
import { Reveal } from './Reveal';

/**
 * Security & compliance section. Legal buyers gate on this.
 *
 * TODO: confirm actual certification status (SOC 2 Type II, ISO 27001, GDPR,
 * data residency options) with the compliance team before launch — do not
 * ship unverified claims.
 */
const SECURITY_ITEMS = [
  {
    icon: ShieldCheck,
    title: 'SOC 2 Type II',
    description: 'Independently audited controls for security, availability, and confidentiality.',
  },
  {
    icon: Lock,
    title: 'Encryption everywhere',
    description: 'AES-256 encryption at rest and TLS 1.2+ in transit, with managed key rotation.',
  },
  {
    icon: Globe2,
    title: 'Data residency',
    description: 'Choose where your data lives, with regional hosting options for the US and EU.',
  },
  {
    icon: FileKey2,
    title: 'Your data stays yours',
    description: 'Customer documents are never used to train models. Full export and deletion on request.',
  },
  {
    icon: UserCheck,
    title: 'SSO & granular access',
    description: 'SAML/OIDC single sign-on, role-based permissions, and per-matter access controls.',
  },
  {
    icon: ServerCog,
    title: 'Audit logging',
    description: 'Immutable audit trails for every document view, edit, and export across your team.',
  },
] as const;

export function SecurityBadges({ showLink = true }: { showLink?: boolean }) {
  return (
    <section id="security" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Security &amp; compliance
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Built for the standards legal work demands
          </h2>
          <p className="mt-4 text-pretty text-zinc-600 dark:text-zinc-400">
            Privilege, confidentiality, and client trust are non-negotiable. Rasind is engineered
            so your most sensitive documents stay protected.
          </p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal
                as="li"
                key={item.title}
                delay={(i % 3) * 90}
                className="flex items-start gap-4 rounded-2xl border border-zinc-200/70 bg-white/60 p-5 shadow-sm backdrop-blur transition-colors hover:border-indigo-300/60 dark:border-zinc-800/70 dark:bg-zinc-900/50 dark:hover:border-indigo-500/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200/70 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ul>

        {showLink && (
          <Reveal className="mt-10 text-center">
            <Link
              href="/security"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Read our full security overview
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Reveal>
        )}
      </div>
    </section>
  );
}
