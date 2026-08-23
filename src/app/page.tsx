import Header from "./_components/Header";
import HeroHeadshot from "./_components/HeroHeadshot";
import SmoothScroll from "./_components/SmoothScroll";
import Work from "./_components/Work";

export default function Home() {
  return (
    // Smooth scrolling is scoped to this route rather than the root layout —
    // see SmoothScroll. `children` crosses the server/client boundary as
    // already-rendered elements, so the header and the headshot stay exactly
    // the components they were.
    <SmoothScroll>
      {/* `min-h-dvh` rather than a fixed `h-dvh`: the header and the headshot
          together are exactly one screen when the page loads — which is what
          sizes the headshot — but the column still has to be free to grow past
          that once the pin adds its scroll length below. */}
      {/* About me section */}
      <div className="min-h-dvh flex flex-col">
        <Header />
        <HeroHeadshot />
      </div>
      {/* My work section */}
      <Work />
    </SmoothScroll>
  );
}
