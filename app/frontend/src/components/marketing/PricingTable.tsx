'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Reveal } from './Reveal';
import { cn } from '@/lib/utils';

/**
 * TODO: replace placeholder pricing numbers, seat limits, and feature gating
 * with the real commercial model before launch.
 */
const TIERS = [
  {
    name: 'Starter',
    description: 'For solo practitioners and small teams getting started with AI review.',
    monthly: 49,
    annual: 39,
    unit: 'per user / month',
    cta: { label: 'Start free trial', href: '/login' },
    highlighted: false,
    features: [
      'Up to 25 contracts / month',
      'AI contract review & risk flags',
      'Standard clause library',
      'Word & PDF export',
      'Email support',
    ],
  },
  {
    name: 'Team',
    description: 'For in-house legal teams standardizing review across the business.',
    monthly: 99,
    annual: 79,
    unit: 'per user / month',
    cta: { label: 'Book a demo', href: '/contact' },
    highlighted: true,
    features: [
      'Unlimited contracts',
      'Custom playbooks & fallback positions',
      'One-click redlining with tracked changes',
      'Legal research with citations',
      'Collaboration, comments & approvals',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    description: 'For firms and enterprises with security, scale, and integration needs.',
    monthly: null,
    annual: null,
    unit: 'custom pricing',
    cta: { label: 'Talk to sales', href: '/contact' },
    highlighted: false,
    features: [
      'Everything in Team',
      'SSO (SAML/OIDC) & SCIM provisioning',
      'Data residency options (US/EU)',
      'Dedicated environment & audit logs',
      'Custom integrations & API access',
      'Named account manager & legal onboarding',
    ],
  },
] as const;

/**
 * Tiered pricing with a monthly/annual toggle. The recommended tier gets a
 * highlighted glass card with a gradient border.
 */
export function PricingTable() {
  const [annual, setAnnual] = React.useState(true);

  return (
    <section id="pricing" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Pricing
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Plans that scale with your caseload
          </h2>
          <p className="mt-4 text-pretty text-zinc-600 dark:text-zinc-400">
            Start free, upgrade when your team is ready. Annual billing saves about 20%.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3">
            <span
              id="billing-monthly-label"
              className={cn(
                'text-sm font-medium',
                !annual ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400',
              )}
            >
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              aria-label="Toggle annual billing"
              onClick={() => setAnnual((v) => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
                annual ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  annual ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
            <span
              className={cn(
                'text-sm font-medium',
                annual ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400',
              )}
            >
              Annual
              <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                Save 20%
              </span>
            </span>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <Reveal
              key={tier.name}
              delay={i * 100}
              className={cn('relative rounded-2xl', tier.highlighted && 'lg:-mt-4 lg:mb-4')}
            >
              {tier.highlighted && (
                <div
                  aria-hidden="true"
                  className="absolute -inset-px rounded-2xl bg-gradient-to-b from-indigo-500 via-violet-500 to-indigo-500"
                />
              )}
              <div
                className={cn(
                  'relative flex h-full flex-col rounded-2xl border bg-white/70 p-7 shadow-sm backdrop-blur dark:bg-zinc-900/70',
                  tier.highlighted
                    ? 'border-transparent shadow-xl shadow-indigo-500/15'
                    : 'border-zinc-200/70 dark:border-zinc-800/70',
                )}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {tier.name}
                </h3>
                <p className="mt-1.5 min-h-[2.5rem] text-sm text-zinc-600 dark:text-zinc-400">
                  {tier.description}
                </p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  {tier.monthly !== null ? (
                    <>
                      <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        ${annual ? tier.annual : tier.monthly}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">{tier.unit}</span>
                    </>
                  ) : (
                    <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                      Custom
                    </span>
                  )}
                </div>
                {tier.monthly !== null && annual && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Billed annually (${(tier.annual ?? 0) * 12}/user/year)
                  </p>
                )}

                <Link
                  href={tier.cta.href}
                  className={cn(
                    'mt-7 inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
                    tier.highlighted
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500'
                      : 'border border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
                  )}
                >
                  {tier.cta.label}
                </Link>

                <ul className="mt-7 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
                        aria-hidden="true"
                      />
                      <span className="text-zinc-700 dark:text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
