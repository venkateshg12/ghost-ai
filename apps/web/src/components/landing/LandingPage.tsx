import CtaBand from "./CtaBand";
import Features from "./Features";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";
import LandingFooter from "./LandingFooter";
import LandingNav from "./LandingNav";
import SpecShowcase from "./SpecShowcase";
import TemplatesShowcase from "./TemplatesShowcase";

// The public marketing page. Rendered only for signed-out visitors (see app/page.tsx).
const LandingPage = () => (
  <div className="min-h-screen bg-base font-sans text-copy-primary">
    <LandingNav />
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <TemplatesShowcase />
      <SpecShowcase />
      <CtaBand />
    </main>
    <LandingFooter />
  </div>
);

export default LandingPage;
