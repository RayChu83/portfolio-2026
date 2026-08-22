"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Image from "next/image";
import type { CSSProperties } from "react";
import { useRef } from "react";
import headshotPhoto from "../../../public/headshot.png";
import kawaiiHeadshotBackground from "../../../public/kawaii_headshot_background.svg";
import kawaiiHeadshotForeground from "../../../public/kawaii_headshot_foreground.svg";
import { useTilt } from "../_hooks/useTilt";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * Camera distance in px. Must stay in step with the `perspective-distant`
 * utility on the scene wrapper, which Tailwind defines as 1200px — the maths
 * below reads depth as a fraction of it.
 */
const PERSPECTIVE = 1200;

/** How far in front of the head the face features float, in px. */
const FOREGROUND_DEPTH = 70;

/**
 * A layer at +z projects larger by PERSPECTIVE / (PERSPECTIVE - depth). Scaling
 * it back by the inverse keeps the features registered to the head at rest, so
 * depth changes only how they slide when the head turns — not how big they are.
 */
const FOREGROUND_SCALE = (PERSPECTIVE - FOREGROUND_DEPTH) / PERSPECTIVE;

/**
 * Degrees the whole head turns at full tilt.
 *
 * One rotation drives both layers, because that is what a rigid object does:
 * the depth between them, not a difference in their angles, is what produces
 * the parallax. Perspective then generates it for free, with the right
 * magnitude everywhere in the frame and the right sign on both sides.
 *
 * rotateX is negative so the two axes agree in handedness — a positive rotateY
 * turns the right edge away from the camera, and a negative rotateX does the
 * same for the bottom edge. Mixing them makes the head follow the pointer
 * sideways while shying away from it vertically.
 */
const SWING = { rotateX: -8, rotateY: 12 };

/**
 * The features float in front of the head, so they cast onto it. The offset
 * leans against the tilt — the shadow pools on the side the layer has slid away
 * from — over a small fixed offset that keeps a light source overhead at rest.
 */
const FOREGROUND_SHADOW =
  "drop-shadow(calc(var(--tilt-x, 0) * -8px + 2px) " +
  "calc(var(--tilt-y, 0) * -8px + 3px) 4px rgb(0 0 0 / 0.2))";

/**
 * How long the headshot stays pinned, as a share of the viewport height. A
 * percentage in a ScrollTrigger `end` measures against the scroller, so this
 * is 200dvh of scrolling spent with the image held still.
 */
const PIN_LENGTH = "+=200%";

/**
 * Where each label's wave of glyphs begins, in timeline units — the scrubbed
 * timeline below is held open to exactly 1, so these read as shares of the pin.
 *
 * The gap between them is the point: overlap them any closer and the two
 * labels land as a single mushy event instead of a one-two beat.
 */
const ROLE_START = 0;
const CRAFT_START = 0.22;

/**
 * How long one glyph takes to arrive, and how long the wave takes to travel
 * across a whole label. `CRAFT_START + CHAR_STAGGER + CHAR_DURATION` is where
 * the last glyph lands — comfortably before the pin is over, so the rest of the
 * hold is spent on the finished picture rather than on type still creeping in.
 */
const CHAR_DURATION = 0.13;
const CHAR_STAGGER = 0.2;

/**
 * The glyph's pose before it arrives: a full line-height below its resting
 * place — which, inside the per-line clip `mask: "lines"` wraps it in, is far
 * enough to be nothing at all — and tipped back onto its own baseline.
 *
 * `transformPerspective` rather than a `perspective` on the line, so every
 * glyph hinges about its own vanishing point. A shared one would foreshorten
 * the ends of a 17-character label far harder than its middle, and the wave
 * would visibly weaken as it travelled.
 *
 * The rotation is positive, tipping the top of the glyph *away* from the
 * camera. Tipping it toward the camera swings it past the picture plane, where
 * it reads as looming rather than as standing up.
 */
const CHAR_FROM = {
  yPercent: 105,
  rotationX: 72,
  transformOrigin: "50% 100% -1px",
  transformPerspective: 420,
};

/**
 * The curve on a single glyph. The timeline as a whole stays linear — under a
 * scrub, scrolling is the easing, and a curve on top of it reads as the words
 * lagging the wheel. But a glyph's own tween is only CHAR_DURATION of the pin,
 * short enough that its curve reads as that one letter snapping into place
 * rather than as the block dragging behind the scroll. That is where the life
 * in the reveal comes from, and why the labels can hold a linear master.
 */
const CHAR_EASE = "power3.out";

/**
 * How long the photograph takes to dolly in and be wiped clear. It begins with
 * the type — that is the point of the whole sequence — but lands well before
 * the last glyph does, at `CRAFT_START + CHAR_STAGGER + CHAR_DURATION`.
 *
 * Ending the two together was the first thing tried and it reads worse. Partly
 * composition: with the type still visibly moving through the whole back half of
 * the picture's arrival there is no moment where the image simply *is*. Partly
 * something less obvious — the top quarter of the frame is empty studio
 * backdrop, so the last stretch of a bottom-to-top wipe uncovers nothing anyone
 * can see, and the picture *looks* resolved at about two-thirds of the wipe.
 *
 * That apparent finish, not the real one, is the deadline every other layer has
 * to clear. Overrun it and the drawing reads as residue left on a photograph
 * rather than as something still on its way out.
 */
const PHOTO_ARRIVE = 0.42;

/**
 * How far behind the drawing the photograph begins, in px.
 *
 * Deliberately *not* compensated by an inverse scale the way FOREGROUND_SCALE
 * compensates the features: there the depth exists only to buy parallax and the
 * size change is an unwanted side effect, whereas here the size change is the
 * effect. Perspective alone grows the photo from 90% to exactly 100% as it
 * dollies to the picture plane, which is what makes it read as approaching
 * rather than as being scaled up.
 */
const PHOTO_DEPTH = -140;

/**
 * How far toward the camera the drawing travels on its way out, in px. Both of
 * its layers lift by the same amount, so the drawing leaves as the one rigid
 * object it has been the whole time — and because it moves toward the lens
 * rather than away, it reads as peeling off the front of the picture to uncover
 * what was always behind it, instead of shrinking into the distance.
 */
const DRAWING_LIFT = 150;

/** How long the linework takes to lift away and fade. */
const DRAWING_EXIT = 0.26;

/**
 * When the drawn features leave, and how long they take. They start after the
 * linework and outlast it, because the wipe uncovers the photo from the bottom
 * up and so the real face is the last part of it to arrive — this parks the
 * drawn eyes and mouth over their counterparts while they surface, and the two
 * faces hand off to each other.
 *
 * The end is the delicate number. Run it past the point where the photograph
 * looks resolved and the drawn eyes stop reading as a handoff and start reading
 * as smudges on the print; 0.12 and then 0.08 were both far enough over to look
 * like exactly that.
 */
const FEATURES_DELAY = 0.06;
const FEATURES_EXIT = 0.3;

/**
 * How far out of focus the photograph starts, in px of blur, and how much of
 * its arrival it spends pulling into focus.
 *
 * Shorter than the wipe on purpose. A focus pull that ran the full span would
 * still be resolving the face at the moment the face appears, which loses the
 * one frame the whole transition is built around; ending it early means the
 * photograph is already sharp and waiting when the wipe finally clears the eyes.
 */
const PHOTO_BLUR = 6;
const PHOTO_FOCUS = 0.28;

/**
 * The photograph is a filled square on a grey studio backdrop, and the drawing
 * is linework on the page's own white. Cross-fading one into the other just
 * slides a grey rectangle over the hero, corners first — so instead the photo
 * is uncovered by a soft-edged wipe that climbs it.
 *
 * The band is driven by a single custom property so GSAP has one number to
 * scrub, with `calc` doing the work of turning it into two gradient stops. At
 * 0 the transparent stop sits at the bottom edge and the whole image is hidden;
 * at 1 the opaque stop has passed the top and all of it shows.
 *
 * Bottom to top for two reasons: it travels the same way the glyphs rise, and
 * it saves the face for last.
 */
const PHOTO_MASK =
  "linear-gradient(to top, " +
  "#000 calc(var(--photo-reveal) * 140% - 40%), " +
  "transparent calc(var(--photo-reveal) * 140%))";

export default function HeroHeadshot() {
  // Driven by the pointer anywhere on the page, or by the device's own tilt on
  // phones and tablets. Publishes `--tilt-x` / `--tilt-y` onto the scene below.
  const sceneRef = useTilt<HTMLDivElement>();
  const stageRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLParagraphElement>(null);
  const craftRef = useRef<HTMLParagraphElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef<HTMLImageElement>(null);
  const featuresRef = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      // Reduced motion gets the headshot in ordinary flow: no pin, and a page
      // 200dvh shorter for it.
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        // Whether the labels should be on screen at all, as opposed to where
        // their glyphs are within the reveal. Everything that hides them —
        // SplitText's line clips, the glyph pose — only exists once this branch
        // has run, so the markup carries a `motion-safe:invisible` to cover the
        // server-rendered paint before it. From here on GSAP owns the property
        // inline, which outranks that class in both directions.
        //
        // Called once by hand on the trigger below as well as from `onToggle`,
        // because a toggle only reports a *change*: land inside the pin — a
        // reload partway down the page — and the trigger is simply born active,
        // with nothing to announce. Left to the callback alone the labels stay
        // hidden for the whole hold.
        const syncLabels = (self: ScrollTrigger) =>
          gsap.set([roleRef.current, craftRef.current], {
            visibility: self.isActive ? "visible" : "hidden",
          });

        // An empty tween is the whole of the timeline's own length. A scrub
        // stretches a timeline across its trigger whatever it contains, so
        // pinning the total at 1 is what lets every constant above be written
        // as a plain share of the pin — and keeps them meaning that even as
        // `autoSplit` tears the labels' tweens out and rebuilds them below.
        const reveal = gsap.timeline().to({}, { duration: 1 }, 0);

        // The photograph dollies up to the picture plane, pulls into focus and
        // is wiped in from below, all across exactly the span the type takes.
        //
        // `ease: "none"` for the same reason the labels' master is linear —
        // under a scrub the wheel is the easing. The glyphs could afford a
        // curve because each one's tween is a thirtieth of the pin; this one
        // runs the whole reveal, and a curve on it would read as the picture
        // lagging the scroll.
        reveal.fromTo(
          photoRef.current,
          { z: PHOTO_DEPTH, "--photo-reveal": 0 },
          { z: 0, "--photo-reveal": 1, ease: "none", duration: PHOTO_ARRIVE },
          0,
        );

        // Its own tween rather than another property on the one above, only
        // because it has to finish sooner. Two tweens can share a target
        // safely as long as they do not share a property — this one owns
        // `filter`, that one owns the transform and the wipe.
        reveal.fromTo(
          photoRef.current,
          { filter: `blur(${PHOTO_BLUR}px)` },
          { filter: "blur(0px)", ease: "none", duration: PHOTO_FOCUS },
          0,
        );

        // The drawing goes the other way, toward the lens and out of the frame.
        // Its two layers keep the depth between them the whole way, so the
        // parallax the tilt gives them survives right up to the last frame they
        // are visible in.
        //
        // Explicit `fromTo` start values rather than letting GSAP read the
        // resting pose off the markup: it has to parse the authored transform
        // either way, and stating both ends means the scrub can be dropped into
        // the middle of the range — which is exactly what a reload halfway down
        // the page does — without the first tick guessing.
        reveal.fromTo(
          drawingRef.current,
          { z: 0 },
          {
            z: DRAWING_LIFT,
            autoAlpha: 0,
            ease: "none",
            duration: DRAWING_EXIT,
          },
          0,
        );

        reveal.fromTo(
          featuresRef.current,
          { z: FOREGROUND_DEPTH, scale: FOREGROUND_SCALE },
          {
            z: FOREGROUND_DEPTH + DRAWING_LIFT,
            // Held at its resting value so GSAP writes the compensation into
            // every frame it rebuilds the transform for. Dropped, the features
            // would jump up to their uncompensated size on the first tick.
            scale: FOREGROUND_SCALE,
            autoAlpha: 0,
            ease: "none",
            duration: FEATURES_EXIT,
          },
          FEATURES_DELAY,
        );

        // Splitting to lines as well as characters is what `mask` needs: it
        // wraps each line in a clip of exactly that line's box, so a glyph
        // sitting a line-height below its resting place is not faint, it is
        // absent. Type that rises out of a hard edge reads as machined; type
        // that fades up reads as a slideshow.
        //
        // `aria: "auto"` hands the paragraph an aria-label of its original text
        // and hides the per-glyph spans, so a screen reader still meets one
        // phrase rather than seventeen letters.
        const splits = [
          { ref: roleRef, at: ROLE_START, from: "start" as const },
          { ref: craftRef, at: CRAFT_START, from: "end" as const },
        ].map(({ ref, at, from }) =>
          SplitText.create(ref.current, {
            type: "lines,chars",
            mask: "lines",
            aria: "auto",
            // Re-splits when the webfont finally lands or the label rewraps at
            // a new width. Without it the first split — measured against the
            // fallback face — leaves line clips at the wrong height for the
            // type they are supposed to be hiding.
            autoSplit: true,
            // Runs once immediately and again on every re-split. Returning the
            // tween is what lets GSAP kill the stale one before building its
            // replacement, so a resize cannot leave two waves fighting over the
            // same glyphs.
            onSplit: (split) => {
              const wave = gsap.fromTo(split.chars, CHAR_FROM, {
                yPercent: 0,
                rotationX: 0,
                duration: CHAR_DURATION,
                ease: CHAR_EASE,
                stagger: {
                  // `amount`, not `each`: the two labels are 17 characters and
                  // 8, and a per-glyph delay would make the short one a flick
                  // and the long one a crawl. Spreading a fixed span over
                  // however many glyphs there are gives both the same sweep.
                  amount: CHAR_STAGGER,
                  // Each wave starts at the corner its label is parked in —
                  // top-left reads rightwards, bottom-right reads leftwards —
                  // so the two of them travel inwards and converge on the face
                  // they are describing.
                  from,
                },
              });

              // `fromTo` starts the tween on the global timeline; adding it
              // moves it under the scrub before any tick can advance it.
              reveal.add(wave, at);
              return wave;
            },
          }),
        );

        const pin = ScrollTrigger.create({
          trigger: stageRef.current,
          // The headshot starts below the header rather than centred, so the
          // pin waits until scrolling has carried it to the middle of the
          // viewport — which happens once half the header has gone.
          start: "center center",
          end: PIN_LENGTH,
          pin: true,
          // Leaves a spacer the height of the pin, so everything below simply
          // carries on in normal flow once the hold is over.
          pinSpacing: true,
          anticipatePin: 1,
          // Hung off the same trigger as the pin rather than a second one of
          // its own: one start and one end means the labels cannot drift out of
          // step with the headshot they belong to, and pinning moves the
          // trigger element in a way a separate ScrollTrigger would have to
          // measure around.
          animation: reveal,
          // Ties progress to scroll position instead of playing on entry, which
          // is what lets scrolling back up run the reveal in reverse.
          scrub: true,
          // Being fixed to the screen, the labels have nothing to scroll them
          // out of the way once the hero is done with them — past the end of
          // the pin the scrub stops updating and leaves them sitting over
          // whatever comes next. Tying them to the trigger's own active window
          // sends them away with the headshot they annotate, and brings them
          // back, mid-reveal, on the way up.
          onToggle: syncLabels,
        });

        // The trigger has measured itself by the time `create` returns, so this
        // is where the labels get their opening state — see `syncLabels`.
        syncLabels(pin);

        // Reverting the media context kills the tweens but leaves the markup
        // SplitText built — including the resize and font-load listeners
        // `autoSplit` registered. These put the original text back.
        return () => splits.forEach((split) => split.revert());
      });

      media.add("(prefers-reduced-motion: reduce)", () => {
        // The photograph is content, not decoration, so this branch still has
        // to deliver it — withholding it would be reading the preference as
        // "show me less" rather than as "do not move large areas of the screen
        // at me". What it drops is the motion: no pin, no dolly toward the
        // camera, no focus pull, and no wipe. The mask is parked wide open and
        // the swap is a plain opacity cross-fade.
        gsap.set(photoRef.current, { "--photo-reveal": 1, autoAlpha: 0 });

        gsap
          .timeline({
            scrollTrigger: {
              trigger: stageRef.current,
              // No pin here means no 200dvh hold to scrub against, so the swap
              // is hung off the stage's own passage up the viewport instead.
              start: "center center",
              end: "bottom top",
              scrub: true,
            },
          })
          .to(photoRef.current, { autoAlpha: 1, ease: "none" }, 0)
          .to(
            [drawingRef.current, featuresRef.current],
            { autoAlpha: 0, ease: "none" },
            0,
          );
      });

      return () => media.revert();
    },
    { scope: stageRef },
  );

  return (
    <>
      {/* Siblings of the stage rather than children of it, and `fixed`, so the
          two of them sit in the corners of the screen. The stage is shorter
          than the viewport — the header takes the rest — so hanging them inside
          it would inset them by half that difference, top and bottom.

          Being `fixed` is not on its own enough to escape it: ScrollTrigger
          holds a pinned element with an identity `transform`, and a transform of
          any kind, identity included, makes an element the containing block for
          the `fixed` descendants beneath it. Out here nothing between these and
          the viewport carries a transform, filter or perspective.

          They are out of flow, so the column above lays out exactly as if they
          were not here and the headshot still takes the whole first screen.

          `motion-safe:invisible` is what keeps them off the server-rendered
          paint. Everything that holds a glyph out of sight — the line clips
          SplitText wraps them in, the pose it starts them from — is built by
          JavaScript, so between first paint and hydration the browser has
          nothing but two finished paragraphs to draw, and draws them. Under the
          same media query the branch that hides them runs, so a visitor who
          asked for reduced motion, whose branch never poses anything, still
          gets both labels. */}
      <p
        ref={roleRef}
        className="fixed top-0 left-0 z-10 p-6 md:p-10 font-aeonik-regular uppercase tracking-tight text-6xl md:text-7xl lg:text-8xl 2xl:text-9xl motion-safe:invisible"
      >
        Software Engineer
      </p>
      <p
        ref={craftRef}
        className="fixed bottom-0 text-right right-0 z-10 p-6 md:p-10 font-aeonik-regular uppercase tracking-tight text-6xl md:text-7xl lg:text-8xl 2xl:text-9xl motion-safe:invisible"
      >
        Who Designs
      </p>
      {/* Takes whatever the header leaves of the first screen, so the two of
          them fill exactly one viewport on landing. ScrollTrigger carries the
          size over to the pin, so the headshot never changes size as it pins
          and unpins. */}
      <div ref={stageRef} className="flex-1 min-h-0 flex justify-center">
        {/* Perspective lives on a wrapper that is exactly the scene's box, so
            the vanishing point sits at the headshot's centre no matter how the
            row around it is laid out. */}
        <div className="h-full aspect-square max-w-full perspective-distant">
          {/* Both SVGs share a 1:1 viewBox with `preserveAspectRatio="xMidYMid
              meet"`, so rendering them into the same square box lines their
              artwork up exactly, whatever size that box ends up. The photograph
              is a 1:1 raster, so it lands on the same grid. */}
          <div
            ref={sceneRef}
            className="relative size-full transform-3d will-change-transform"
            style={{
              transform:
                `rotateX(calc(var(--tilt-y, 0) * ${SWING.rotateX}deg)) ` +
                `rotateY(calc(var(--tilt-x, 0) * ${SWING.rotateY}deg))`,
            }}
          >
            {/* First in the markup, but that is not what puts it at the back:
                inside `transform-3d` the layers paint by depth, and this one
                spends the whole transition at or behind z=0 while the drawing
                spends it climbing to +190. DOM order only decides ties.

                It carries the real alt text and the drawing is marked
                decorative, because the two are the same subject and a screen
                reader should meet it once. */}
            <Image
              ref={photoRef}
              src={headshotPhoto}
              alt="Ray"
              loading="eager"
              fill
              // The box is square and as tall as the stage, so its width tracks
              // the viewport's height rather than its width.
              sizes="100vh"
              className="block pointer-events-none object-contain will-change-transform"
              style={
                {
                  "--photo-reveal": 0,
                  maskImage: PHOTO_MASK,
                  WebkitMaskImage: PHOTO_MASK,
                  maskSize: "100% 100%",
                  WebkitMaskSize: "100% 100%",
                } as CSSProperties
              }
            />
            <Image
              ref={drawingRef}
              src={kawaiiHeadshotBackground}
              alt=""
              aria-hidden
              loading="eager"
              fill
              className="block pointer-events-none object-contain"
              style={{ transform: "translateZ(0px)" }}
            />
            <Image
              ref={featuresRef}
              src={kawaiiHeadshotForeground}
              alt=""
              aria-hidden
              loading="eager"
              fill
              className="block pointer-events-none object-contain"
              style={{
                transform: `translateZ(${FOREGROUND_DEPTH}px) scale(${FOREGROUND_SCALE})`,
                filter: FOREGROUND_SHADOW,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
