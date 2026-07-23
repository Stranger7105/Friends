type Props = {
  src?: string | null;
  initials: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
  className?: string;
};

const sizes = {
  sm: "h-10 w-10 text-sm rounded-2xl",
  md: "h-14 w-14 text-lg rounded-2xl",
  lg: "h-24 w-24 text-2xl rounded-[26px]",
  xl: "h-36 w-36 text-4xl rounded-[34px]",
};

export default function AuroraAvatar({
  src,
  initials,
  alt = "Avatar",
  size = "md",
  online = false,
  className = "",
}: Props) {
  return (
    <div className={`relative inline-flex ${className}`}>
      <div
        className={[
          "group flex shrink-0 items-center justify-center overflow-hidden",
          "border-4 border-white/90 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500",
          "font-bold text-white shadow-[0_18px_45px_rgba(79,70,229,0.30)]",
          "transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-105",
          sizes[size],
        ].join(" ")}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          initials
        )}
      </div>

      {online && (
        <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400 shadow" />
      )}
    </div>
  );
}
