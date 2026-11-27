import Header from "./_components/Header";
import SocialLinks from "./_components/SocialLinks";
import Work from "./_components/Work";
import Footer from "./_components/Footer";

export default function Home() {
  return (
    <>
      <SocialLinks />
      <main className="relative z-10 bg-white">
        <div className="max-w-[1920px] m-auto">
          <Header />
          <Work />
        </div>
      </main>
      <Footer />
    </>
  );
}
