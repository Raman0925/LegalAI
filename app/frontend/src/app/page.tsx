import type { Metadata } from 'next';
import { Navbar } from '@/components/marketing/Navbar';
import { Hero } from '@/components/marketing/Hero';
import { LogoMarquee } from '@/components/marketing/LogoMarquee';
import { FeatureBentoGrid } from '@/components/marketing/FeatureBentoGrid';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { SecurityBadges } from '@/components/marketing/SecurityBadges';
import { TestimonialCarousel } from '@/components/marketing/TestimonialCarousel';
import { PricingTable } from '@/components/marketing/PricingTable';
import { CTASection } from '@/components/marketing/CTASection';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Rasind — AI contract review & legal research for legal teams',
  description:
    'Rasind analyzes contracts, flags risky clauses, drafts redlines, and answers legal research questions with citations. Built for GCs, legal ops, and law firms.',
};

export default function Home() {
  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <Navbar />
      <main>
        <Hero />
        <LogoMarquee />
        <FeatureBentoGrid />
        <HowItWorks />
        <SecurityBadges />
        <TestimonialCarousel />
        <PricingTable />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
