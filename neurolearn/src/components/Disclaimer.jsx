/**
 * Reusable disclaimer component shown on all analysis views.
 */
export default function Disclaimer() {
  return (
    <div className="mt-8 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
      <strong className="font-semibold text-foreground/70">Note: </strong>
      NeuroLearn provides screening insights to support learning. It does not provide a medical
      diagnosis. For a full evaluation, speak with an educational specialist or psychologist.
    </div>
  );
}
