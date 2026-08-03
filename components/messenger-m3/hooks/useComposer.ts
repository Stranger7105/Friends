"use client";

import { useState } from "react";

export default function useComposer() {
  const [text, setText] = useState("");

  function clear() {
    setText("");
  }

  return {
    text,
    setText,
    clear,
  };
}