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
        "rounded-[28px] border border-white/60 bg-white/80 shadow-[0_18px_60px_rgba(30,41,59,0.10)] backdrop-blur-2xl",
        interactive
          ? "transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_24px_70px_rgba(79,70,229,0.16)]"
          : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
