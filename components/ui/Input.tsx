"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type InputSize    = "sm" | "md" | "lg";
export type InputVariant = "default" | "error" | "success";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?:     string;
  hint?:      string;
  error?:     string;
  /** @deprecated Use hint */
  helper?:    string;
  size?:      InputSize;
  variant?:   InputVariant;
  startIcon?: React.ElementType;
  endIcon?:   React.ElementType;
  /** Clickable end-icon handler */
  onEndClick?: () => void;
  /** Text rendered before value, e.g. "SAR" */
  prefix?:    string;
  /** Text rendered after value, e.g. "%" */
  suffix?:    string;
  /** Any node placed at the end inside the input shell */
  endSlot?:   React.ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const sizes: Record<InputSize, { h: string; text: string; px: string; icon: string }> = {
  sm: { h: "h-8",  text: "text-xs", px: "px-2.5", icon: "h-3.5 w-3.5" },
  md: { h: "h-10", text: "text-sm", px: "px-3",   icon: "h-4   w-4"   },
  lg: { h: "h-11", text: "text-sm", px: "px-3.5", icon: "h-4   w-4"   },
};

const ringByVariant: Record<InputVariant, string> = {
  default: [
    "border-[hsl(var(--border))]",
    "focus-within:border-[hsl(var(--accent-cyan)/0.55)]",
    "focus-within:ring-1 focus-within:ring-[hsl(var(--accent-cyan)/0.2)]",
  ].join(" "),
  error: [
    "border-rose-400/50",
    "focus-within:border-rose-400",
    "focus-within:ring-1 focus-within:ring-rose-400/20",
  ].join(" "),
  success: [
    "border-emerald-400/50",
    "focus-within:border-emerald-400",
    "focus-within:ring-1 focus-within:ring-emerald-400/20",
  ].join(" "),
};

// ── Input ─────────────────────────────────────────────────────────────────────

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      helper,
      size         = "md",
      variant      = "default",
      startIcon:   Start,
      endIcon:     End,
      onEndClick,
      prefix,
      suffix,
      endSlot,
      fullWidth    = true,
      className,
      containerClassName,
      id: providedId,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId   = useId();
    const id            = providedId ?? generatedId;
    const hintText      = hint ?? helper;
    const errorId       = `${id}-error`;
    const hintId        = `${id}-hint`;
    const resolvedVariant: InputVariant = error ? "error" : variant;
    const sz            = sizes[size];

    const hasStart = !!(Start || prefix);
    const hasEnd   = !!(End || endSlot || suffix);

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full", containerClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={id}
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-2))]"
          >
            {label}
          </label>
        )}

        {/* Shell */}
        <div
          className={cn(
            "flex items-center w-full rounded-xl border",
            "bg-[hsl(var(--bg-input))] transition-all duration-150",
            sz.h,
            ringByVariant[resolvedVariant],
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {/* Start icon */}
          {Start && (
            <span className="pl-3 shrink-0 text-[hsl(var(--text-3))] pointer-events-none" aria-hidden>
              <Start className={sz.icon} />
            </span>
          )}

          {/* Prefix text */}
          {prefix && (
            <span className={cn("pl-3 shrink-0 select-none text-[hsl(var(--text-3))] font-medium", sz.text)}>
              {prefix}
            </span>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            className={cn(
              "flex-1 min-w-0 bg-transparent outline-none border-none ring-0",
              "text-[hsl(var(--text-1))] placeholder:text-[hsl(var(--text-3))]",
              "disabled:cursor-not-allowed tabular-nums",
              sz.text, sz.px,
              hasStart && "pl-2",
              hasEnd   && "pr-2",
              className,
            )}
            aria-invalid={!!error || undefined}
            aria-describedby={
              error   ? errorId :
              hintText ? hintId  : undefined
            }
            {...props}
          />

          {/* Suffix text */}
          {suffix && (
            <span className={cn("pr-3 shrink-0 select-none text-[hsl(var(--text-3))] font-medium", sz.text)}>
              {suffix}
            </span>
          )}

          {/* End icon — optionally clickable */}
          {End && !endSlot && (
            onEndClick ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={onEndClick}
                className="pr-3 shrink-0 text-[hsl(var(--text-3))] hover:text-[hsl(var(--text-1))] transition-colors"
                aria-label="Input action"
              >
                <End className={sz.icon} />
              </button>
            ) : (
              <span className="pr-3 shrink-0 text-[hsl(var(--text-3))] pointer-events-none" aria-hidden>
                <End className={sz.icon} />
              </span>
            )
          )}

          {/* Custom end slot */}
          {endSlot && (
            <span className="pr-2 shrink-0">{endSlot}</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-rose-400 leading-snug">
            {error}
          </p>
        )}

        {/* Hint */}
        {!error && hintText && (
          <p id={hintId} className="text-xs text-[hsl(var(--text-3))] leading-snug">
            {hintText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

// ── Textarea ──────────────────────────────────────────────────────────────────

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:    string;
  hint?:     string;
  error?:    string;
  variant?:  InputVariant;
  fullWidth?: boolean;
  containerClassName?: string;
  rows?: number;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      hint,
      error,
      variant    = "default",
      fullWidth  = true,
      rows       = 3,
      className,
      containerClassName,
      id: providedId,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId     = useId();
    const id              = providedId ?? generatedId;
    const errorId         = `${id}-error`;
    const resolvedVariant: InputVariant = error ? "error" : variant;

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full", containerClassName)}>
        {label && (
          <label
            htmlFor={id}
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-2))]"
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={id}
          rows={rows}
          disabled={disabled}
          className={cn(
            "w-full rounded-xl border bg-[hsl(var(--bg-input))]",
            "text-sm text-[hsl(var(--text-1))] placeholder:text-[hsl(var(--text-3))]",
            "px-3 py-2.5 outline-none transition-all duration-150 resize-none",
            ringByVariant[resolvedVariant],
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />

        {error && (
          <p id={errorId} role="alert" className="text-xs text-rose-400 leading-snug">
            {error}
          </p>
        )}
        {!error && hint && (
          <p className="text-xs text-[hsl(var(--text-3))] leading-snug">{hint}</p>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
