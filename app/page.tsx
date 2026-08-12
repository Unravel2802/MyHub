import { HomeBackground } from "@/src/components/home/HomeBackground";
import { HomeFocusStrip } from "@/src/components/home/HomeFocusStrip";
import { HomeMomentumPanel } from "@/src/components/home/HomeMomentumPanel";
import { OrbitalHub } from "@/src/components/home/OrbitalHub";
import { PageTemplate } from "@/src/components/ui/PageTemplate";

// The hub's own card grid (one card per mini-app, one per core tool) was
// removed once the orbit stopped being hover-only, and the WorkspacePanel
// that replaced it was itself removed in the 2026-08-12 literal-match pass:
// the reference design never swaps the Momentum rail out for a module list.
// The keyboard/navigation route to every module is the orbit itself — each
// node is a real <button> (Tab reaches it, Enter expands it) and each moon
// is a real <Link> to its module, interleaved in DOM order right after its
// planet's button. See src/components/home/OrbitalHub.tsx.
export default function Home() {
  return (
    <PageTemplate
      contentWidth="full"
      description="Choose a workspace and get back to the work that matters."
      eyebrow="Home"
      hero={
        <HomeBackground>
          <OrbitalHub panel={<HomeMomentumPanel />} />
        </HomeBackground>
      }
      href="/"
      title="Your apps"
    >
      <HomeFocusStrip />
    </PageTemplate>
  );
}
