"use client";

type StoryProgressProps = {
  count: number;
  activeIndex: number;
  progress: number;
};

export default function StoryProgress({ count, activeIndex, progress }: StoryProgressProps) {
  return (
    <div className="aurora-story-progress" aria-label="Progres poveste">
      {Array.from({ length: count }).map((_, index) => {
        const width = index < activeIndex ? 100 : index === activeIndex ? progress : 0;
        return (
          <span key={index} className="aurora-story-progress-track">
            <span className="aurora-story-progress-fill" style={{ width: `${width}%` }} />
          </span>
        );
      })}
    </div>
  );
}
