import { CtaBanner } from "../components/homepage/cta-banner";
import { FAQ } from "../components/homepage/faq";
import { Features } from "../components/homepage/features";
import { Footer } from "../components/homepage/footer";
import { Hero } from "../components/homepage/hero";
import { HowItWorks } from "../components/homepage/how-it-works";
import { Navbar } from "../components/homepage/navbar";
import { Pricing } from "../components/homepage/pricing";
import { Showcase } from "../components/homepage/showcase";
import { Stats } from "../components/homepage/stats";
import { Testimonials } from "../components/homepage/testimonials";

export default function HomePage() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[linear-gradient(180deg,#FDFEFE_0%,#F9FCFA_18%,#FFFFFF_100%)]">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <Showcase />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CtaBanner />
      <Footer />
    </main>
  );
}
