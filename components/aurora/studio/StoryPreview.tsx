"use client";

type StoryPreviewProps = {
  imageUrl: string;
  onClose: () => void;
};

export default function StoryPreview({
  imageUrl,
  onClose,
}: StoryPreviewProps) {
  return (
    <div
      className="aurora-story-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Previzualizare Story"
    >
      <button
        type="button"
        className="aurora-story-preview-backdrop"
        onClick={onClose}
        aria-label="Închide previzualizarea"
      />

      <section className="aurora-story-preview-card">
        <div className="aurora-story-preview-progress">
          <span />
        </div>

        <header>
          <div className="aurora-story-preview-avatar">F</div>
          <div>
            <strong>Povestea ta</strong>
            <span>Previzualizare</span>
          </div>

          <button type="button" onClick={onClose} aria-label="Închide">
            ×
          </button>
        </header>

        <img src={imageUrl} alt="Previzualizarea Story-ului" />

        <footer>
          Story-ul va arăta astfel înainte de publicare.
        </footer>
      </section>
    </div>
  );
}
