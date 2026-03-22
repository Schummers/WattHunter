import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — WattHunter",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-6 text-[length:var(--type-body)] text-[var(--text-mid)] leading-relaxed">
      <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
        Privacy Policy
      </h1>
      <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
        Last updated: March 22, 2026
      </p>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          1. Information We Collect
        </h2>
        <p>
          When you create an account on WattHunter, we collect the following
          information:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong className="text-[var(--text-high)]">Email address</strong>{" "}
            — used for authentication and account recovery.
          </li>
          <li>
            <strong className="text-[var(--text-high)]">Display name</strong>{" "}
            — the name you choose for your team profile.
          </li>
          <li>
            <strong className="text-[var(--text-high)]">
              Google profile information
            </strong>{" "}
            — if you sign in with Google, we receive your name, email, and
            profile picture from Google. We do not access any other Google
            services or data.
          </li>
        </ul>
        <p>
          We also collect game-related data you generate while using WattHunter
          (team composition, bids, policy choices). This data is essential to
          provide the game experience.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          2. How We Use Your Information
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>To create and manage your account.</li>
          <li>To provide and operate the WattHunter game.</li>
          <li>To display leaderboards and team rankings to other players in your league.</li>
          <li>To communicate important updates about your account or the game.</li>
        </ul>
        <p>
          We do <strong className="text-[var(--text-high)]">not</strong> use
          your data for advertising, profiling, or any purpose unrelated to the
          WattHunter service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          3. Data Storage & Security
        </h2>
        <p>
          Your data is stored securely on{" "}
          <strong className="text-[var(--text-high)]">Supabase</strong>{" "}
          (hosted on AWS infrastructure in the EU). We use industry-standard
          security measures including encrypted connections (TLS), row-level
          security policies, and secure authentication tokens.
        </p>
        <p>We do not sell, rent, or share your personal data with third parties.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          4. Cookies & Tracking
        </h2>
        <p>
          WattHunter uses only essential cookies required for authentication
          (session tokens). We do not use analytics trackers, advertising
          cookies, or any third-party tracking scripts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          5. Your Rights
        </h2>
        <p>You have the right to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your account and associated data.</li>
          <li>Export your data in a portable format.</li>
        </ul>
        <p>
          To exercise any of these rights, please contact us at the address
          below.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          6. Data Retention
        </h2>
        <p>
          We retain your data for as long as your account is active. If you
          delete your account, we will remove your personal data within 30
          days. Anonymized game statistics may be retained for leaderboard
          integrity.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          7. Changes to This Policy
        </h2>
        <p>
          We may update this privacy policy from time to time. We will notify
          you of any significant changes through the app. Continued use of
          WattHunter after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          8. Contact
        </h2>
        <p>
          If you have questions about this privacy policy or your data, contact
          us at:{" "}
          <a
            href="mailto:jonathan.schummers@gmail.com"
            className="text-[var(--accent-default)] hover:text-[var(--accent-highlight)] underline"
          >
            jonathan.schummers@gmail.com
          </a>
        </p>
      </section>
    </article>
  );
}
