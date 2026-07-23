import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type Shared = { label: string; hint?: string };
type InputProps = Shared & InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
type TextareaProps = Shared & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true };

export default function AuroraInput(props: InputProps | TextareaProps) {
  const { label, hint, multiline, className = "", ...fieldProps } = props;

  const fieldClass = [
    "w-full rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3 text-slate-900",
    "outline-none transition-all duration-200 placeholder:text-slate-400",
    "focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-200/50",
    className,
  ].join(" ");

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {multiline ? (
        <textarea
          className={fieldClass}
          {...(fieldProps as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          className={fieldClass}
          {...(fieldProps as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {hint && <span className="mt-2 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
