import Header from "./_components/Header";
import HeroHeadshot from "./_components/HeroHeadshot";
import DeferredWork from "./_components/DeferredWork";

export default function Home() {
  return (
    <>
      <div className="min-h-dvh flex flex-col">
        <Header />
        <HeroHeadshot />
      </div>
      <DeferredWork />
    </>
  );
}
