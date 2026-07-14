import Link from 'next/link';
import { Linkedin, Scale, Twitter } from 'lucide-react';

const FOOTER_LINKS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Book a demo', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      // TODO: create real privacy policy and terms pages before launch.
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of service', href: '/terms' },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/70 dark:bg-zinc-900/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2" aria-label="Rasind home">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Scale className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                rasind<span className="text-indigo-600 dark:text-indigo-400">.tech</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              AI-powered contract review, redlining, and legal research for teams that read the
              fine print.
            </p>
            <div className="mt-5 flex gap-3">
              {/* TODO: add real social profile URLs */}
              <a
                href="https://x.com/rasindtech"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Rasind on X (Twitter)"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400"
              >
                <Twitter className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="https://www.linkedin.com/company/rasindtech"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Rasind on LinkedIn"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400"
              >
                <Linkedin className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          {FOOTER_LINKS.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {group.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-600 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-200/70 pt-8 sm:flex-row dark:border-zinc-800/70">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            © {new Date().getFullYear()} Rasind Technologies. All rights reserved.
          </p>
          <p className="max-w-md text-center text-xs text-zinc-400 sm:text-right dark:text-zinc-600">
            Rasind provides software, not legal advice. Output should be reviewed by a qualified
            attorney.
          </p>
        </div>
      </div>
    </footer>
  );
}
