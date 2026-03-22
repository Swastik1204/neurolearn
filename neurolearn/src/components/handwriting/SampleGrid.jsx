import { Image as ImageIcon } from 'lucide-react';

export default function SampleGrid({ samples = [], onSampleClick }) {
  if (samples.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No handwriting samples yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {samples.map((sample) => (
        <button
          key={sample.id}
          onClick={() => onSampleClick(sample)}
          className="group relative aspect-[3/1] rounded-xl border-2 border-border overflow-hidden bg-[#FAFAF7] hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
        >
          <img
            src={sample.imageUrl}
            alt={`Handwriting sample: ${sample.promptWord || 'writing'}`}
            className="w-full h-full object-contain p-2"
            loading="lazy"
          />

          {/* Status badge */}
          <div className="absolute top-2 right-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              sample.analysisStatus === 'complete'
                ? 'bg-success/10 text-success'
                : sample.analysisStatus === 'processing'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {sample.analysisStatus === 'complete' ? '✓ Analyzed' :
               sample.analysisStatus === 'processing' ? '⏳ Processing' : '• Pending'}
            </span>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-sm font-medium text-primary bg-white/80 px-3 py-1 rounded-lg">
              View Analysis
            </span>
          </div>

          {/* Word label */}
          {sample.promptWord && (
            <div className="absolute bottom-2 left-2 text-xs font-medium text-muted-foreground bg-white/80 px-2 py-0.5 rounded">
              "{sample.promptWord}"
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
