import type { Metadata } from "next";
import { JerseySpotlight } from "@/components/examples/jersey-spotlight";

export const metadata: Metadata = {
  title: "Jersey Spotlight | A-Frame Project",
  description:
    "A branded A-Frame showroom that renders a 3D jersey GLB with dramatic lighting and live color selection.",
};

export default function JerseySpotlightPage() {
  return <JerseySpotlight />;
}
