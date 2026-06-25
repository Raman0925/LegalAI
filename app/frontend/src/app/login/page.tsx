import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 transition-colors duration-200">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center text-center">
          {/* Logo Mark */}
          <div className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4 shadow-md">
            <span className="text-2xl text-white dark:text-zinc-900" role="img" aria-label="gavel">
              ⚖️
            </span>
          </div>

          {/* Brand Name & Tagline */}
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            LegalAI
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs">
            AI-powered workflows for legal professionals.
          </p>
        </div>

        {/* Action Area */}
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs text-uppercase">
              <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500 dark:text-zinc-400">
                Secure Portal
              </span>
            </div>
          </div>

          <GoogleSignInButton />
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-zinc-500 dark:text-zinc-500 mt-6">
          By signing in, you agree to our terms and privacy policy.
        </div>
      </div>
    </main>
  );
}
