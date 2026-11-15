import type { Metadata } from "next";
import ClubBase from "@/components/club-base";
import "./base.css";
import "../../club-base-3d.css";

/** The base overview: a data-driven map of the club's rooms. */
export const metadata: Metadata = {
  title: "The base — Questbound FC",
  description: "Your club's rooms: training ground, tactics room, dressing room, stadium, trophy room, transfers, league and cup.",
};

export default function ClubBasePage() {
  return <ClubBase />;
}
