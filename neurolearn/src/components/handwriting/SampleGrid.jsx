import { Image as ImageIcon, Trash2 } from 'lucide-react';

const EMOTION_EMOJI = {
  happy: '🙂',
  sad: '😢',
  angry: '😠',
  fearful: '😨',
  disgusted: '🤢',
  surprised: '😮',
  neutral: '😐',
};

export default function SampleGrid({ samples = [], onSampleClick, onDeleteClick }) {
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
        <div
          key={sample.id}
          className="group relative aspect-[3/1] rounded-xl border-2 border-border overflow-hidden bg-[#FAFAF7] hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
        >
          <button
            type="button"
            onClick={() => onSampleClick(sample)}
            className="absolute inset-0 z-0"
            aria-label={`View analysis for ${sample.promptWord || 'exercise'}`}
          />

          <div className="w-full h-full relative z-0 pointer-events-none" aria-hidden="true">
            <img
              src={sample.imageBase64 || sample.imageUrl}
              alt={`Handwriting sample: ${sample.promptWord || 'writing'}`}
              className="w-full h-full object-contain p-2"
              loading="lazy"
            />
          </div>

          {/* Status badge */}
          <div className="absolute top-2 right-2 pointer-events-none z-20">
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

          {/* Delete action */}
          {onDeleteClick && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteClick(sample);
              }}
              className="absolute top-2 left-2 w-8 h-8 rounded-lg bg-error/90 hover:bg-error text-white flex items-center justify-center transition-all z-20 hover:scale-110 active:scale-95"
              aria-label="Delete exercise"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Hover overlay with clickable hint - only above the image, not overlapping delete button */}
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
            <span className="text-sm font-medium text-primary bg-white/90 px-3 py-1.5 rounded-lg shadow-sm">
              Click to View
            </span>
          </div>

          {/* Word label */}
          {sample.promptWord && (
            <div className="absolute bottom-2 left-2 text-xs font-medium text-muted-foreground bg-white/80 px-2 py-0.5 rounded pointer-events-none z-20">
              "{sample.promptWord}"
            </div>
          )}

          {sample.emotionAtSubmit && (
            <div className="absolute bottom-2 right-2 text-xs font-medium text-foreground bg-white/85 px-2 py-0.5 rounded pointer-events-none z-20">
              {EMOTION_EMOJI[sample.emotionAtSubmit] || '😐'} {sample.emotionAtSubmit}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
