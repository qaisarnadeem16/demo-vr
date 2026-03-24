import type { Metadata } from "next";
import { SuperheroFlightGame } from "./_components/game";

export const metadata: Metadata = {
  title: "Superhero Flight | A-Frame Project",
  description:
    "An endless low-poly superhero flying game built with A-Frame and Next.js.",
};

export default function SuperheroFlightPage() {
  return <SuperheroFlightGame />;
}
