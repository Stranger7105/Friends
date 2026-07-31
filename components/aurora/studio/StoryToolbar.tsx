"use client";

import type { StoryTool } from "./story-editor.types";

type Tool = {
  id: StoryTool;
  icon: string;
  label: string;
  enabled: boolean;
};

const TOOLS: Tool[] = [
  { id: "select", icon: "↖", label: "Selectare", enabled: true },
  { id: "text", icon: "T", label: "Text", enabled: false },
  { id: "stickers", icon: "✦", label: "Stickere", enabled: false },
  { id: "draw", icon: "✎", label: "Desen", enabled: false },
  { id: "filters", icon: "◐", label: "Filtre", enabled: false },
];

type StoryToolbarProps = {
  activeTool: StoryTool;
  onToolChange: (tool: StoryTool) => void;
};

export default function StoryToolbar({
  activeTool,
  onToolChange,
}: StoryToolbarProps) {
  return (
    <nav className="aurora-studio-toolbar" aria-label="Unelte Story Studio">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`aurora-studio-tool ${
            activeTool === tool.id ? "aurora-studio-tool-active" : ""
          }`}
          disabled={!tool.enabled}
          onClick={() => onToolChange(tool.id)}
          title={
            tool.enabled
              ? tool.label
              : `${tool.label} va fi activat într-un pachet următor`
          }
        >
          <span>{tool.icon}</span>
          <strong>{tool.label}</strong>
          {!tool.enabled && <small>curând</small>}
        </button>
      ))}
    </nav>
  );
}
