import { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  interactive?: boolean;
};

export default function AuroraCard({
  children,
  interactive = false,
  className = "",
  ...props
}: Props) {
  return (
    <div
      className={[
        "aurora-card-shell group relative overflow-hidden rounded-[28px] border border-white/60 bg-white/80 shadow-[0_18px_60px_rgba(30,41,59,0.10)] backdrop-blur-2xl",
        interactive
          ? "aurora-card-interactive transition-all duration-500 ease-out hover:-translate-y-1.5 hover:scale-[1.012] hover:shadow-[0_30px_85px_rgba(16,185,129,0.18)]"
          : "",
        className,
      ].join(" ")}
      {...props}
    >
      <span className="aurora-card-shimmer pointer-events-none absolute inset-x-10 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <span className="aurora-card-orb pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-0 blur-3xl transition-all duration-700 group-hover:scale-125 group-hover:opacity-100" />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
