"use client";

import { useContext } from "react";
import { CallContext } from "./CallProvider";

export default function useCall() {
  const context = useContext(CallContext);

  if (!context) {
    throw new Error("useCall trebuie folosit în interiorul CallProvider.");
  }

  return context;
}
