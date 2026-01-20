"use client";

import { useEffect } from "react";

export default function ConsoleSilencer() {
  useEffect(() => {
    const noop = () => {};
    console.log = noop;
    console.debug = noop;
  }, []);

  return null;
}
