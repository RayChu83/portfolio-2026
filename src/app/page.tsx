import Header from "./_components/Header";
import HeroHeadshot from "./_components/HeroHeadshot";

export default function Home() {
  return (
    // `min-h-dvh` rather than a fixed `h-dvh`: the header and the headshot
    // together are exactly one screen when the page loads — which is what sizes
    // the headshot — but the column still has to be free to grow past that once
    // the pin adds its scroll length below.
    <>
      <div className="min-h-dvh flex flex-col">
        <Header />
        <HeroHeadshot />
      </div>
      <div className="h-screen"></div>
    </>
  );
}
