import type { Metadata } from "next";
import { ThreeSixtyTour } from "@/components/examples/three-sixty-tour";

export const metadata: Metadata = {
  title: "360 Tour | A-Frame Project",
  description: "A multi-panorama 360 A-Frame tour with compact navigation.",
};

export default function ThreeSixtyTourPage() {
  return <ThreeSixtyTour />;
}
