import AuthSection from "./AuthSection";
import Link from "next/link";

export function Header() {
  return (
    <header className="flex justify-between items-center p-4 bg-blue-600 text-white fixed top-0 left-0 right-0 z-[3000]">
      <Link href="/" className="text-2xl font-bold">
        TruthSpot
      </Link>
      <AuthSection />
    </header>
  );
}
