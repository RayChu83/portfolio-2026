"use client";

import { useEffect, useRef } from "react";
import { useIsTiltableDevice } from "./useIsTiltableDevice";

/** How far the device has to lean, in degrees, to reach a full-strength tilt. */
const DEVICE_TILT_RANGE_DEG = 25;

/** Spring frequency in rad/s. Higher chases the pointer more eagerly. */
const STIFFNESS = 14;

/**
 * Damping ratio. Under 1 the tilt overshoots a little and settles back, and
 * that small settle is what reads as the head having mass — a pure exponential
 * ease arrives asymptotically, which looks like it is moving through syrup.
 */
const DAMPING = 0.7;

/**
 * The spring is integrated at this fixed step whatever the display's refresh
 * rate, so the motion feels identical at 60Hz and 120Hz. A per-frame ease does
 * not: it converges twice as fast on a 120Hz screen.
 */
const STEP = 1 / 240;

/**
 * Longest real time a single frame may advance the spring. Past this — a tab
 * that was hidden, a long task — catching up over hundreds of steps is both
 * wasteful and visually worse than simply skipping the gap.
 */
const MAX_FRAME = 1 / 15;

/** Below these, in tilt units and tilt units/second, the motion has arrived. */
const SETTLED_OFFSET = 0.0005;
const SETTLED_VELOCITY = 0.0005;

/**
 * How far the input has to move, in tilt units, before the target is updated.
 *
 * The pointer needs no such filter — it goes still when the hand does — but a
 * real accelerometer never reports the same reading twice, and without a dead
 * zone that noise re-arms the spring on every `deviceorientation` event: the
 * rAF loop never parks and the whole page pays a 60 fps tax for a head that
 * is visibly at rest (PERFORMANCE-AUDIT.md, P0-4). 0.012 tilt units is 0.3°
 * of physical lean — below anything a hand can hold deliberately.
 */
const TARGET_DEAD_ZONE = 0.012;

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Tracks a global tilt input and exposes it as two CSS custom properties on the
 * returned element: `--tilt-x` and `--tilt-y`, each a unitless number in
 * [-1, 1]. Anything underneath styles itself off those, which is what lets one
 * pointer drive a whole 3D scene without any of it re-rendering:
 *
 *     transform: rotateY(calc(var(--tilt-x) * 6deg))
 *
 * The input is the pointer's position across the whole viewport on desktop, or
 * the device's physical lean on phones and tablets — see `useIsTiltableDevice`.
 * Either way, -1 is left/top and 1 is right/bottom.
 *
 * Values are written straight to the DOM inside a rAF loop rather than kept in
 * state, so a moving pointer never re-renders the tree. The loop runs a damped
 * spring toward the latest input and parks itself once it arrives. Honours
 * `prefers-reduced-motion`, where it simply never moves off centre.
 */
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const isTiltable = useIsTiltableDevice();

  useEffect(() => {
    // Still waiting on the client-side device check.
    if (isTiltable === null) return;

    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };

    let frame: number | null = null;
    let lastTime = 0;
    let backlog = 0;

    // Semi-implicit Euler on a damped spring, one axis at a time.
    const advance = (axis: "x" | "y") => {
      const offset = current[axis] - target[axis];
      const acceleration =
        -STIFFNESS * STIFFNESS * offset -
        2 * DAMPING * STIFFNESS * velocity[axis];

      velocity[axis] += acceleration * STEP;
      current[axis] += velocity[axis] * STEP;
    };

    const render = (time: number) => {
      // The first frame of a run has no previous timestamp to measure against,
      // so it renders the current pose and starts the clock.
      backlog += lastTime ? Math.min((time - lastTime) / 1000, MAX_FRAME) : 0;
      lastTime = time;

      while (backlog >= STEP) {
        advance("x");
        advance("y");
        backlog -= STEP;
      }

      const settled =
        Math.abs(current.x - target.x) < SETTLED_OFFSET &&
        Math.abs(current.y - target.y) < SETTLED_OFFSET &&
        Math.abs(velocity.x) < SETTLED_VELOCITY &&
        Math.abs(velocity.y) < SETTLED_VELOCITY;

      if (settled) {
        current.x = target.x;
        current.y = target.y;
        velocity.x = 0;
        velocity.y = 0;
      }

      element.style.setProperty("--tilt-x", current.x.toFixed(4));
      element.style.setProperty("--tilt-y", current.y.toFixed(4));

      if (settled) {
        // Parking clears the clock so the next run's first frame doesn't hand
        // the spring however long the tilt sat still as a single timestep.
        frame = null;
        lastTime = 0;
        backlog = 0;
        return;
      }

      frame = requestAnimationFrame(render);
    };

    const setTarget = (x: number, y: number, deadZone = 0) => {
      const nextX = clamp(x, -1, 1);
      const nextY = clamp(y, -1, 1);
      if (
        deadZone > 0 &&
        Math.abs(nextX - target.x) < deadZone &&
        Math.abs(nextY - target.y) < deadZone
      ) {
        return;
      }
      target.x = nextX;
      target.y = nextY;
      frame ??= requestAnimationFrame(render);
    };

    const cleanups: Array<() => void> = [];

    // The input listeners are attached only while the tilted element is
    // actually on screen and the tab is visible. Without this the spring runs
    // for the whole session — the hero's tilt is invisible from the moment
    // the visitor scrolls past it, and a backgrounded tab has no frames at
    // all, yet both kept paying for the loop. `attach`/`detach` are filled in
    // by whichever input branch runs below; the observers own *when*.
    let attachInput: () => void = () => {};
    let detachInput: () => void = () => {};
    let inputActive = false;
    let onScreen = false;

    const syncInput = () => {
      const shouldRun = onScreen && document.visibilityState === "visible";
      if (shouldRun === inputActive) return;
      inputActive = shouldRun;
      if (shouldRun) {
        attachInput();
      } else {
        detachInput();
        // Park the loop too: with no input coming there is nothing to chase,
        // and a settled spring re-arms itself on the next setTarget anyway.
        if (frame !== null) {
          cancelAnimationFrame(frame);
          frame = null;
          lastTime = 0;
          backlog = 0;
        }
      }
    };

    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? false;
      syncInput();
    });
    intersection.observe(element);

    const handleVisibility = () => syncInput();
    document.addEventListener("visibilitychange", handleVisibility);
    cleanups.push(() => {
      intersection.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      if (inputActive) detachInput();
    });

    if (isTiltable) {
      // `beta` leans the device away from / toward you, `gamma` side to side.
      // The first reading becomes the neutral pose, so whatever angle the phone
      // is already being held at reads as centred.
      let origin: { beta: number; gamma: number } | null = null;

      const handleOrientation = (event: DeviceOrientationEvent) => {
        const { beta, gamma } = event;
        if (beta === null || gamma === null) return;

        origin ??= { beta, gamma };

        setTarget(
          (gamma - origin.gamma) / DEVICE_TILT_RANGE_DEG,
          (beta - origin.beta) / DEVICE_TILT_RANGE_DEG,
          // See TARGET_DEAD_ZONE — sensor noise must not keep the spring
          // permanently awake.
          TARGET_DEAD_ZONE
        );
      };

      // Permission (where required) is only ever granted once; after that the
      // visibility machinery attaches and detaches the listener freely.
      const listen = () => {
        attachInput = () =>
          window.addEventListener("deviceorientation", handleOrientation);
        detachInput = () =>
          window.removeEventListener("deviceorientation", handleOrientation);
        syncInput();
      };

      const requestPermission = (
        DeviceOrientationEvent as DeviceOrientationEventWithPermission
      ).requestPermission;

      if (typeof requestPermission === "function") {
        // iOS only hands out orientation data after an explicit grant, and only
        // asks when a user gesture is in flight — so the prompt rides on the
        // visitor's first touch.
        let cancelled = false;

        const handleGesture = () => {
          requestPermission()
            .then((state) => {
              if (state === "granted" && !cancelled) listen();
            })
            .catch(() => {
              // Denied or unavailable: the headshot just stays level.
            });
        };

        window.addEventListener("touchend", handleGesture, { once: true });
        cleanups.push(() => {
          cancelled = true;
          window.removeEventListener("touchend", handleGesture);
        });
      } else {
        listen();
      }
    } else {
      const handlePointerMove = (event: PointerEvent) => {
        setTarget(
          (event.clientX / window.innerWidth) * 2 - 1,
          (event.clientY / window.innerHeight) * 2 - 1
        );
      };

      // Leaving the window returns the tilt to centre rather than stranding it
      // at whatever edge the pointer left through.
      const handlePointerLeave = () => setTarget(0, 0);

      attachInput = () => {
        window.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerleave", handlePointerLeave);
      };
      detachInput = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerleave", handlePointerLeave);
      };
      syncInput();
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      if (frame !== null) cancelAnimationFrame(frame);
      element.style.removeProperty("--tilt-x");
      element.style.removeProperty("--tilt-y");
    };
  }, [isTiltable]);

  return ref;
}
