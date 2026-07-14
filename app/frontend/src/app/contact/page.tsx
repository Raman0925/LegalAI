import type { Metadata } from 'next';
import { CalendarClock, Mail, MessageSquareText } from 'lucide-react';
import { Navbar } from '@/components/marketing/Navbar';
import { ContactForm } from '@/components/marketing/ContactForm';
import { Footer } from '@/components/marketing/Footer';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Book a demo — Rasind',
  description:
    'See Rasind review a real contract in a 30-minute walkthrough. Book a demo or contact our team.',
};

const CONTACT_POINTS = [
  {
    icon: CalendarClock,
    title: '30-minute walkthrough',
    body: 'A live session tailored to your workflows — bring one of your own contracts (redacted is fine).',
  },
  {
    icon: MessageSquareText,
    title: 'Answers from engineers',
    body: 'Security, integration, and deployment questions answered by the people who built the product.',
  },
  {
    icon: Mail,
    title: 'Prefer email?',
    body: 'Reach us at hello@rasind.tech and we will respond within one business day.',
    // TODO: confirm the sales/demo inbox address.
  },
] as const;

export default function ContactPage() {
  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <Navbar />
      <main className="pt-20">
        <section className="relative overflow-hidden py-16 sm:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="marketing-aurora absolute -top-32 left-1/3 h-[26rem] w-[40rem] rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="marketing-grid-bg absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
                See Rasind on your own contracts
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
                Tell us a little about your team and we will set up a demo built around the
                documents you actually work with.
              </p>

              <ul className="mt-10 space-y-6">
                {CONTACT_POINTS.map((point, i) => {
                  const Icon = point.icon;
                  return (
                    <Reveal as="li" key={point.title} delay={i * 90} className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-200/70 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                          {point.title}
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {point.body}
                        </p>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>
            </div>

            <Reveal delay={150}>
              <ContactForm />
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
