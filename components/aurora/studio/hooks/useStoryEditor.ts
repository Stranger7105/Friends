"use client";

import { useEffect, useMemo, useState } from "react";
import { useHistory } from "./useHistory";
import type {
  StoryEditorDraft,
  StoryLayer,
  StoryTool,
} from "../story-editor.types";

function makeInitialDraft(): StoryEditorDraft {
  return {
    imageFile: null,
    imageUrl: null,
    layers: [],
    selectedLayerId: null,
    createdAt: new Date().toISOString(),
  };
}

export function useStoryEditor() {
  const history = useHistory<StoryEditorDraft>(makeInitialDraft());
  const [activeTool, setActiveTool] = useState<StoryTool>("select");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (history.value.imageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(history.value.imageUrl);
      }
    };
  }, [history.value.imageUrl]);

  function selectImage(file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Fișierul ales nu este o fotografie.");
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error("Fotografia depășește limita de 15 MB.");
    }

    if (history.value.imageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(history.value.imageUrl);
    }

    const imageUrl = URL.createObjectURL(file);
    const imageLayer: StoryLayer = {
      id: crypto.randomUUID(),
      type: "image",
      name: file.name,
      visible: true,
      locked: true,
    };

    history.set({
      imageFile: file,
      imageUrl,
      layers: [imageLayer],
      selectedLayerId: imageLayer.id,
      createdAt: new Date().toISOString(),
    });
  }

  function removeImage() {
    if (history.value.imageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(history.value.imageUrl);
    }

    history.set(makeInitialDraft());
  }

  function selectLayer(layerId: string) {
    history.set((current) => ({
      ...current,
      selectedLayerId: layerId,
    }));
  }

  function toggleLayerVisibility(layerId: string) {
    history.set((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer,
      ),
    }));
  }

  const selectedLayer = useMemo(
    () =>
      history.value.layers.find(
        (layer) => layer.id === history.value.selectedLayerId,
      ) ?? null,
    [history.value.layers, history.value.selectedLayerId],
  );

  function resetEditor() {
    if (history.value.imageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(history.value.imageUrl);
    }

    history.reset(makeInitialDraft());
    setActiveTool("select");
    setPreviewOpen(false);
  }

  return {
    draft: history.value,
    selectedLayer,
    activeTool,
    previewOpen,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    setActiveTool,
    setPreviewOpen,
    selectImage,
    removeImage,
    selectLayer,
    toggleLayerVisibility,
    undo: history.undo,
    redo: history.redo,
    resetEditor,
  };
}
