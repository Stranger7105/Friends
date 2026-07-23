import { ReactNode } from "react";
import AuroraCard from "./AuroraCard";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export default function AuroraSection({
  title,
  subtitle,
  children,
  className = "",
}: Props) {
  return (
    <AuroraCard className={`p-6 sm:p-7 ${className}`}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </AuroraCard>
  );
}
