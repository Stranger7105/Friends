"use client";

import type { StoryLayer } from "./story-editor.types";

type StoryLayersProps = {
  layers: StoryLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
};

export default function StoryLayers({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisibility,
}: StoryLayersProps) {
  return (
    <aside className="aurora-studio-layers">
      <div className="aurora-studio-panel-title">
        <div>
          <span>STRUCTURĂ</span>
          <h3>Straturi</h3>
        </div>

        <span className="aurora-studio-layer-count">{layers.length}</span>
      </div>

      {layers.length === 0 ? (
        <div className="aurora-studio-empty-layers">
          <strong>Niciun strat încă</strong>
          <p>Fotografia aleasă va deveni primul strat.</p>
        </div>
      ) : (
        <div className="aurora-studio-layer-list">
          {[...layers].reverse().map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={`aurora-studio-layer ${
                layer.id === selectedLayerId
                  ? "aurora-studio-layer-selected"
                  : ""
              }`}
              onClick={() => onSelectLayer(layer.id)}
            >
              <span className="aurora-studio-layer-icon">
                {layer.type === "image" ? "▧" : "◇"}
              </span>

              <span className="aurora-studio-layer-copy">
                <strong>{layer.name}</strong>
                <small>{layer.locked ? "Fundal blocat" : layer.type}</small>
              </span>

              <span
                role="button"
                tabIndex={0}
                className="aurora-studio-layer-eye"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleVisibility(layer.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggleVisibility(layer.id);
                  }
                }}
                aria-label={
                  layer.visible ? "Ascunde stratul" : "Afișează stratul"
                }
              >
                {layer.visible ? "◉" : "○"}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="aurora-studio-coming-next">
        <span>URMEAZĂ ÎN 4.0A.2</span>
        <p>Text editabil, mutare, redimensionare, culori și fonturi.</p>
      </div>
    </aside>
  );
}
