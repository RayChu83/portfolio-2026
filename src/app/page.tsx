import Header from "./_components/Header";
import HeroHeadshot from "./_components/HeroHeadshot";
import DeferredWork from "./_components/DeferredWork";
import SocialLinks from "./_components/SocialLinks";

export default function Home() {
  return (
    <>
      {/* Outside the hero's `relative z-10` wrapper on purpose. It is fixed to
          the viewport rather than to any section, and its `mix-blend-mode`
          only sees a backdrop it shares a stacking context with — put inside
          that wrapper it would blend against the hero alone and go on doing so
          over a black work section. */}
      <SocialLinks />
      {/* `relative z-10` is the hero's standing claim on the layer above
          whatever follows it, and it exists for one element: the animated
          build's "From New York City", which is `absolute` inside the pinned
          stage and deliberately hangs past the stage's own bottom edge (see
          PLACE_BOTTOM in HeroAnimated). Everything below reserves flow space
          for that overhang, so the two should never meet — but "should never
          meet" is a measurement, and a measurement can be stale for a frame on
          a phone whose address bar is still moving. This says what the right
          answer is when they do meet, rather than leaving it to the painting
          order that falls out of how ScrollTrigger happens to pin (`fixed` on
          a desktop, `transform` on a touch device) — the caption is hero, the
          section under it is ground, and the ground never comes up over it. */}
      <div className="relative z-10 min-h-dvh flex flex-col">
        <Header />
        <HeroHeadshot />
      </div>
      <DeferredWork />
    </>
  );
}
