import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Goal Tracker',
  description: 'How Goal Tracker handles your data, including data from Garmin Connect.',
};

const LAST_UPDATED = '8 November 2026';
const CONTACT = 'akshar@umbra-agents.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text)' }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Privacy Policy</h1>
        <p className="text-xs mb-8" style={{ color: 'var(--text-2)' }}>Goal Tracker by Umbra Agents · Last updated {LAST_UPDATED}</p>

        <Section title="Who we are">
          <p>
            Goal Tracker is a personal goal, habit and productivity tracker operated by Umbra Agents.
            Questions about this policy or your data: <a href={`mailto:${CONTACT}`} style={{ color: 'var(--gold)' }}>{CONTACT}</a>.
          </p>
        </Section>

        <Section title="Data we collect">
          <p>Data you enter in the app: goals, tasks, habits, diary entries, sleep and wake times, and settings.</p>
          <p>
            If you connect a Garmin account, data you choose to share from Garmin Connect: daily summaries (steps,
            distance, calories, intensity minutes, heart rate), sleep, heart rate variability, stress, Body Battery,
            pulse oximetry, respiration, fitness metrics (such as VO₂ max) and activities. If you install our Garmin
            watch face or watch app, it sends heart rate, stress, Body Battery, SpO₂ and daily activity totals from
            your watch.
          </p>
        </Section>

        <Section title="How we use Garmin data">
          <p>
            Garmin data is used only to show you your own health and activity metrics inside your Goal Tracker
            account, and to help you relate them to your goals, habits and productivity. It is visible only to you.
          </p>
          <p>We do not use Garmin data for advertising, profiling for third parties, or any purpose other than the above.</p>
        </Section>

        <Section title="Selling and sharing">
          <p>We do not sell Garmin data or any other personal data, and we do not share it with third parties for their own use.</p>
        </Section>

        <Section title="Service providers that process your data">
          <p>The following providers process data on our behalf, only to run the service:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Vercel Inc.</strong> hosts the application and processes requests, including Garmin data sent to the app.</li>
            <li><strong>Supabase Inc.</strong> hosts the database where your data, including Garmin data, is stored.</li>
            <li><strong>Garmin Ltd.</strong> provides the Garmin Connect data you choose to share with us.</li>
            <li><strong>Resend</strong> delivers reminder emails (these do not contain Garmin data).</li>
            <li><strong>Groq</strong> provides AI features for goals, tasks and diary text you enter (these do not receive Garmin data).</li>
          </ul>
        </Section>

        <Section title="AI transparency">
          <p>
            Garmin data is <strong>not</strong> sent to or processed by any AI system, and Garmin data and anything
            derived from it are never used to train, evaluate or improve AI models. If this ever changes, we will
            update this policy and ask for your explicit consent first, with an easy way to withdraw it at any time.
          </p>
        </Section>

        <Section title="Your choices and rights">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Disconnect Garmin:</strong> Settings → Garmin → Disconnect in the app, or remove Goal Tracker in Garmin Connect (Settings → Connected Apps). We stop receiving new data immediately.</li>
            <li><strong>Change permissions:</strong> choose which Garmin data types are shared in Garmin Connect at any time.</li>
            <li><strong>Access or export:</strong> email us and we will send you a copy of your data in a machine-readable format.</li>
            <li><strong>Correct or delete:</strong> email us and we will correct or permanently delete your data, including all Garmin data, within 30 days.</li>
            <li><strong>Withdraw consent:</strong> disconnecting Garmin withdraws consent for new data; ask us to delete what is already stored.</li>
          </ul>
        </Section>

        <Section title="Security and retention">
          <p>
            Data is sent over encrypted connections (HTTPS) and stored in an access-controlled database. Garmin access
            tokens are stored server-side only. We keep your data while your account is active and delete it on request.
          </p>
        </Section>

        <Section title="Changes">
          <p>We will update this page when our practices change and revise the date above.</p>
        </Section>
      </div>
    </main>
  );
}
