import { notFound } from "next/navigation";

// Any address no page matches shows the not-found page in the visitor's
// language (the root not-found has no layout around it).
export default function Unknown() {
  notFound();
}
