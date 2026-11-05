import type { Metadata } from "next";
import AboutContent from "./AboutContent";

export const metadata: Metadata = { title: "Бидний тухай" };

export default function AboutPage() {
  return (
    <AboutContent />
  );
}
