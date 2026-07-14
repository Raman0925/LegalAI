'use client';

import * as React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * Demo-request form.
 *
 * TODO: wire `onSubmit` to a real backend (CRM webhook, email service, or an
 * API route) before launch — currently it only simulates a submission
 * client-side and stores nothing.
 */
export function ContactForm() {
  const [status, setStatus] = React.useState<'idle' | 'submitting' | 'done'>('idle');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    // Simulated async submit — replace with a real request.
    window.setTimeout(() => setStatus('done'), 900);
  };

  if (status === 'done') {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-10 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10"
      >
        <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Request received
        </h3>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          Thanks — our team will reach out within one business day to schedule your demo.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-zinc-200/70 bg-white/70 p-7 shadow-sm backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-900/60"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contact-name" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Full name
          </label>
          <Input id="contact-name" name="name" required autoComplete="name" placeholder="Jane Doe" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-email" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Work email
          </label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="jane@company.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contact-company" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Company / firm
          </label>
          <Input id="contact-company" name="company" required autoComplete="organization" placeholder="Acme Corp" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-size" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Legal team size
          </label>
          <select
            id="contact-size"
            name="teamSize"
            required
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:border-zinc-800"
          >
            <option value="" disabled>
              Select…
            </option>
            <option value="1-5">1–5</option>
            <option value="6-20">6–20</option>
            <option value="21-100">21–100</option>
            <option value="100+">100+</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          What would you like to see? <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={4}
          placeholder="e.g. NDA review workflows, playbook setup, security review…"
          className="flex w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:border-zinc-800"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-70"
      >
        {status === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {status === 'submitting' ? 'Sending…' : 'Request a demo'}
      </button>

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
        We only use your details to respond to this request. No newsletters, no spam.
      </p>
    </form>
  );
}
