"use client";

import { useEffect } from "react";
import "@/styles/story-studio.css";
import StoryCanvas from "./StoryCanvas";
import StoryHeader from "./StoryHeader";
import StoryLayers from "./StoryLayers";
import StoryPreview from "./StoryPreview";
import StoryToolbar from "./StoryToolbar";
import type { StoryEditorDraft } from "./story-editor.types";
import { useStoryEditor } from "./hooks/useStoryEditor";

type StoryStudioProps = {
  open: boolean;
  onClose: () => void;
  onPublish: (draft: StoryEditorDraft) => void;
};

export default function StoryStudio({
  open,
  onClose,
  onPublish,
}: StoryStudioProps) {
  const editor = useStoryEditor();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (editor.previewOpen) {
          editor.setPreviewOpen(false);
        } else {
          onClose();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, onClose, open]);

  if (!open) return null;

  function closeStudio() {
    const hasDraft = Boolean(editor.draft.imageFile);

    if (
      hasDraft &&
      !window.confirm("Închizi editorul? Modificările nesalvate se pierd.")
    ) {
      return;
    }

    editor.resetEditor();
    onClose();
  }

  return (
    <div
      className="aurora-studio"
      role="dialog"
      aria-modal="true"
      aria-label="Story Studio"
    >
      <div className="aurora-studio-ambient aurora-studio-ambient-one" />
      <div className="aurora-studio-ambient aurora-studio-ambient-two" />

      <StoryHeader
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        canPreview={Boolean(editor.draft.imageUrl)}
        canPublish={Boolean(editor.draft.imageFile)}
        onClose={closeStudio}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onPreview={() => editor.setPreviewOpen(true)}
        onPublish={() => onPublish(editor.draft)}
      />

      <div className="aurora-studio-workspace">
        <StoryLayers
          layers={editor.draft.layers}
          selectedLayerId={editor.draft.selectedLayerId}
          onSelectLayer={editor.selectLayer}
          onToggleVisibility={editor.toggleLayerVisibility}
        />

        <StoryCanvas
          imageUrl={
            editor.draft.layers[0]?.visible
              ? editor.draft.imageUrl
              : null
          }
          onSelectImage={editor.selectImage}
          onRemoveImage={editor.removeImage}
        />

        <aside className="aurora-studio-inspector">
          <div className="aurora-studio-panel-title">
            <div>
              <span>PROPRIETĂȚI</span>
              <h3>Inspector</h3>
            </div>
          </div>

          {editor.selectedLayer ? (
            <div className="aurora-studio-inspector-card">
              <span>STRAT SELECTAT</span>
              <strong>{editor.selectedLayer.name}</strong>
              <p>
                Instrumentele de transformare și editare vor apărea aici.
              </p>
            </div>
          ) : (
            <div className="aurora-studio-empty-layers">
              <strong>Nimic selectat</strong>
              <p>Alege o fotografie sau un strat.</p>
            </div>
          )}

          <div className="aurora-studio-shortcuts">
            <strong>Scurtături</strong>
            <span><kbd>Ctrl</kbd> + <kbd>Z</kbd> Anulează</span>
            <span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> Refă</span>
            <span><kbd>Esc</kbd> Închide</span>
          </div>
        </aside>
      </div>

      <StoryToolbar
        activeTool={editor.activeTool}
        onToolChange={editor.setActiveTool}
      />

      {editor.previewOpen && editor.draft.imageUrl && (
        <StoryPreview
          imageUrl={editor.draft.imageUrl}
          onClose={() => editor.setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
