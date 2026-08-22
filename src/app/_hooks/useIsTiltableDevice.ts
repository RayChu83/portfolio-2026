"use client";

import { useEffect, useState } from "react";

/**
 * Whether this device is one you tilt rather than point at: phones and tablets
 * (iPads included), as opposed to anything driven by a mouse or trackpad.
 *
 * A device qualifies when it has no hover-capable primary pointer *and* the
 * browser exposes orientation events. Both halves matter — a touchscreen laptop
 * reports a coarse pointer but still has a mouse, and a phone with orientation
 * events blocked can't drive a tilt.
 *
 * Returns `null` until the first client render, because none of this is knowable
 * on the server. Callers should treat `null` as "not decided yet" and hold off
 * rather than falling back to the pointer branch, which would attach listeners
 * that immediately need tearing down.
 */
export function useIsTiltableDevice(): boolean | null {
  const [isTiltable, setIsTiltable] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(hover: none) and (pointer: coarse)");
    const hasOrientationEvents = "DeviceOrientationEvent" in window;

    const update = () => setIsTiltable(query.matches && hasOrientationEvents);

    update();

    // Re-evaluates when the pointer situation actually changes, e.g. a tablet
    // being docked with a mouse, or a desktop browser's device emulation.
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isTiltable;
}
