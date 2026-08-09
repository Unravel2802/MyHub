import { HomeBackground } from "@/src/components/home/HomeBackground";
import { HomeFocusStrip } from "@/src/components/home/HomeFocusStrip";
import { HomeMomentumPanel } from "@/src/components/home/HomeMomentumPanel";
import { OrbitalHub } from "@/src/components/home/OrbitalHub";
import { PageTemplate } from "@/src/components/ui/PageTemplate";

// The hub's own card grid (one card per mini-app, one per core tool) was
// removed once the orbit stopped being hover-only: a node is a real <button>
// now, so Tab reaches it, Enter/Space opens its panel (WorkspacePanel), and
// Tab again reaches that panel's module links — the same destinations the
// grid pointed at, through the orbit itself rather than a duplicate list
// beside it. See src/components/home/OrbitalHub.tsx's click-to-lock model.
export default function Home() {
  return (
    <PageTemplate
      contentWidth="full"
      description="Choose a workspace and get back to the work that matters."
      eyebrow="Home"
      hero={
        <HomeBackground>
          <OrbitalHub idlePanel={<HomeMomentumPanel />} />
        </HomeBackground>
      }
      href="/"
      title="Your apps"
    >
      <HomeFocusStrip />
    </PageTemplate>
  );
}
