import { useState } from 'react';

export default function ConsentModal({ isOpen, onAccept, onDecline }) {
  const [checked, setChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-xl shadow-2xl border border-border max-w-lg w-full max-h-[85vh] flex flex-col animate-scale-in">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Data Collection Consent</h2>
          <p className="text-sm text-muted-foreground mt-1">
            COPPA & DPDP Compliance Notice
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-sm text-foreground leading-relaxed space-y-4">
          <p>
            As a guardian, you are providing consent on behalf of your child. Please read the following carefully:
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">📝 What we collect</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Handwriting samples (images of practice exercises)</li>
                <li>Stroke data (pen/finger movement patterns during writing)</li>
                <li>Session data (time spent, exercises completed)</li>
                <li>Basic profile information (name, grade level)</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">🔍 How we use it</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>To analyze handwriting for dyslexia indicators</li>
                <li>To track learning progress over time</li>
                <li>To generate personalized weekly reports for you</li>
                <li>To provide tailored exercise recommendations</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">🔒 How we protect it</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All data is encrypted in transit and at rest</li>
                <li>Data is stored securely in Firebase (Google Cloud)</li>
                <li>Only you and authorized teachers can access your child's data</li>
                <li>We never sell or share data with third parties</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">🗑️ Your rights</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>You can request complete deletion of all data at any time</li>
                <li>You can download a copy of your child's data</li>
                <li>You can revoke consent and deactivate the account</li>
                <li>Contact us at privacy@dyslexiaed.app for any concerns</li>
              </ul>
            </div>
          </div>

          <label className="flex items-start gap-3 p-4 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-input accent-primary cursor-pointer"
              id="consent-checkbox"
            />
            <span className="text-sm">
              I have read and understood the above. I consent to the collection and processing of my
              child's data as described. I confirm I am the parent or legal guardian of the child using
              this platform.
            </span>
          </label>
        </div>

        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 py-3 px-4 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-all"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={!checked}
            className="flex-1 py-3 px-4 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
