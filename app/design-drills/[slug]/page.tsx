import { DesignDrillsPage } from "@/src/modules/designDrills/components/DesignDrillsPage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <DesignDrillsPage slug={slug} />;
}
