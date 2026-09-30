import type { Metadata } from 'next';
import { PageShell } from '@/components/site/page-shell';
import { RoadmapBoard } from '@/components/feedback/roadmap-board';

export const metadata: Metadata = {
  title: 'Feedback & roadmap',
  description: 'BrokerIQ को बेहतर बनाने में मदद करें — नए features suggest करें, vote करें और roadmap देखें।',
};

export default function FeedbackPage() {
  return (
    <PageShell>
      <section className="mesh-hero py-14 text-white">
        <div className="container-x">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Feedback & roadmap</h1>
          <p className="mt-2 max-w-2xl text-white/75">आप बताइए, हम बनाएँगे। नए features suggest करें, दूसरों के ideas पर vote करें और देखें क्या बन रहा है।</p>
        </div>
      </section>
      <RoadmapBoard />
    </PageShell>
  );
}
