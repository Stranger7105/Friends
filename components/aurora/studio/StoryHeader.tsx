"use client";

type StoryHeaderProps = {
  canUndo: boolean;
  canRedo: boolean;
  canPreview: boolean;
  canPublish: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onPublish: () => void;
};

export default function StoryHeader({
  canUndo,
  canRedo,
  canPreview,
  canPublish,
  onClose,
  onUndo,
  onRedo,
  onPreview,
  onPublish,
}: StoryHeaderProps) {
  return (
    <header className="aurora-studio-header">
      <div className="aurora-studio-heading">
        <button
          type="button"
          className="aurora-studio-icon-button"
          onClick={onClose}
          aria-label="Închide Story Studio"
        >
          ×
        </button>

        <div>
          <span>FRIENDS AURORA</span>
          <h2>Story Studio</h2>
        </div>
      </div>

      <div className="aurora-studio-header-actions">
        <button
          type="button"
          className="aurora-studio-soft-button"
          onClick={onUndo}
          disabled={!canUndo}
        >
          ↶ Anulează
        </button>

        <button
          type="button"
          className="aurora-studio-soft-button"
          onClick={onRedo}
          disabled={!canRedo}
        >
          ↷ Refă
        </button>

        <button
          type="button"
          className="aurora-studio-soft-button"
          onClick={onPreview}
          disabled={!canPreview}
        >
          ◉ Previzualizare
        </button>

        <button
          type="button"
          className="aurora-studio-publish-button"
          onClick={onPublish}
          disabled={!canPublish}
        >
          Publică Story
        </button>
      </div>
    </header>
  );
}
