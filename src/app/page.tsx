import HeroHeadshot from "./_components/HeroHeadshot";

export default function Home() {
  // `overflow-hidden`: the headshot sits flush with the bottom of the viewport,
  // so tilting it projects its near edge a few dozen pixels past the fold.
  // Clipping keeps a decorative transform from putting a scrollbar on a
  // one-screen page — the overflow is the artwork's own empty margin.
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <header className="pt-20 pb-4">
        <h1 className="text-center font-aeonik-regular tracking-tight mb-8">
          <span className="text-neutral-600 text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
            Hey there,
          </span>
          <br />{" "}
          <span className="text-black! text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl">
            I'm Ray
          </span>
        </h1>
        <h4 className="text-center text-2xl md:text-3xl font-aeonik-regular tracking-tight">
          {/* Swapped by media query rather than by feature detection, so the
              server and client render the same markup. */}
          <span className="[@media(hover:none)]:hidden">Try to hover me</span>
          <span className="hidden [@media(hover:none)]:inline">
            Tap and drag over me
          </span>
        </h4>
      </header>
      <HeroHeadshot />
    </div>
  );
}
