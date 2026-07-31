export type StoryLayerType = "image" | "text" | "sticker" | "drawing";

export type StoryLayer = {
  id: string;
  type: StoryLayerType;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type StoryEditorDraft = {
  imageFile: File | null;
  imageUrl: string | null;
  layers: StoryLayer[];
  selectedLayerId: string | null;
  createdAt: string;
};

export type StoryTool =
  | "select"
  | "text"
  | "stickers"
  | "draw"
  | "filters";
