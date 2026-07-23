"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});

type ChatInputProps = {
  text: string;
  sending: boolean;
  onTextChange: (value: string) => void;
  onTypingChange: (isTyping: boolean) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
};

export default function ChatInput({
  text,
  sending,
  onTextChange,
  onTypingChange,
  onSend,
}: ChatInputProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowEmojiPicker(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);

      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }
    };
  }, [showEmojiPicker]);

  function scheduleTypingStop() {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      onTypingChange(false);
    }, 1200);
  }

  function handleTextChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;

    onTextChange(value);

    if (!value.trim()) {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }

      onTypingChange(false);
      return;
    }

    onTypingChange(true);
    scheduleTypingStop();
  }

  function handleEmojiClick(emojiData: EmojiClickData) {
    const input = inputRef.current;
    const emoji = emojiData.emoji;

    if (!input) {
      onTextChange(`${text}${emoji}`);
      setShowEmojiPicker(false);
      onTypingChange(true);
      scheduleTypingStop();
      return;
    }

    const selectionStart = input.selectionStart ?? text.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;

    const nextText =
      text.slice(0, selectionStart) +
      emoji +
      text.slice(selectionEnd);

    onTextChange(nextText);
    setShowEmojiPicker(false);
    onTypingChange(true);
    scheduleTypingStop();

    requestAnimationFrame(() => {
      const nextCursorPosition = selectionStart + emoji.length;

      input.focus();
      input.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition
      );
    });
  }

  return (
    <form
      onSubmit={onSend}
      className="relative flex items-center gap-3 border-t p-4"
    >
      <div ref={emojiPickerRef} className="relative">
        <button
          type="button"
          onClick={() =>
            setShowEmojiPicker((current) => !current)
          }
          className="flex h-12 w-12 items-center justify-center rounded-xl border bg-white text-2xl hover:bg-gray-50"
          aria-label="Deschide lista de emoji"
          aria-expanded={showEmojiPicker}
          title="Emoji"
        >
          😊
        </button>

        {showEmojiPicker && (
          <div className="absolute bottom-14 left-0 z-50">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={350}
              height={430}
              searchPlaceHolder="Caută emoji..."
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
            />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        value={text}
        onChange={handleTextChange}
        maxLength={5000}
        placeholder="Scrie un mesaj..."
        autoComplete="off"
        className="min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none focus:border-emerald-400"
      />

      <button
        type="submit"
        disabled={sending || !text.trim()}
        className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
      >
        {sending ? "..." : "Trimite"}
      </button>
    </form>
  );
}