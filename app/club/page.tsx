import type { Metadata } from "next";
import ClubPreview from "@/components/club-preview";
import "../club.css";

/** Outside the app shell on purpose: /club is the self-contained club workspace. */
export const metadata: Metadata = {
  title: "Club management — Questbound FC",
  description:
    "Your club: squad, line ratings, training, tactics, facilities and line-up. Changes are saved to your private planner through the normal command path.",
};

export default function ClubPage() {
  return <ClubPreview />;
}
