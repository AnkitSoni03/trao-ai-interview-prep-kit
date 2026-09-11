"use client";

import { useLayoutEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * A textarea that grows to fit its content instead of clipping it behind an internal
 * scrollbar. Used for anything showing generated text (question prompts, answer outlines,
 * flashcard sides, the company brief) so the box size follows the data instead of the data
 * being hidden inside a fixed-size box.
 */
export function AutoTextarea({ className = "", rows = 2, onInput, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }

  useLayoutEffect(() => {
    if (ref.current) resize(ref.current);
  }, [props.value]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      onInput={(e) => {
        resize(e.currentTarget);
        onInput?.(e);
      }}
      className={`field resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}
