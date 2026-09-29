import Header from "./_components/Header";
import DeferredWork from "./_components/DeferredWork";
import SocialLinks from "./_components/SocialLinks";
import Footer from "./_components/Footer";

export default function Home() {
  return (
    <>
      {/* Outside the hero's `relative z-10` wrapper on purpose. It is fixed to
          the viewport rather than to any section, and its `mix-blend-mode`
          only sees a backdrop it shares a stacking context with — put inside
          that wrapper it would blend against the hero alone and go on doing so
          over a black work section. */}
      <SocialLinks />
      {/* The page proper, as one opaque layer above the footer.
          `Footer` is `sticky bottom-0`, which means its box is parked against
          the bottom of the screen for the whole of the scroll it takes to
          uncover it — so what keeps it hidden until then is not position but
          paint order, and that is this wrapper's only job. `z-10` puts the
          page above it and `bg-white` stops it showing through the gaps
          between sections; take either away and the footer is visible through
          the hero from the first frame.

      {/* A `<main>` rather than a `<div>`. The element already was the page's
          content — everything between the floating nav and the footer — and
          saying so costs nothing: it gives assistive technology the landmark
          to jump to, and it tells a crawler which part of the document is the
          page rather than the chrome around it. There was no `<main>` anywhere
          on the site before this. */}
      <main className="relative z-10 bg-white">
        <Header />
        <DeferredWork />
      </main>
      <Footer />
    </>
  );
}
