import { redirect } from "next/navigation";

// Single-user build: public registration is disabled. Anyone opening
// /register (including the owner) lands back on sign-in.
export default function RegisterPage() {
  redirect("/login");
}
