import Link from "next/link";
import { PlatformPoweredBy } from "@/components/platform-powered-by";
import { AGENCY_URL } from "@/lib/platform-brand";

interface LandingFooterProps {
  brandName: string;
}

const QUICK_LINKS = [
  { href: "#story", label: "Story" },
  { href: "#product", label: "Product" },
  { href: "#plans", label: "Plans" },
  { href: "#trial", label: "Free trial" },
  { href: "/login", label: "Login" },
];

export function LandingFooter({ brandName }: LandingFooterProps) {
  return (
    <footer className="border-t border-[#14201c]/[0.08] bg-white text-[#5c6b64]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white">
                {brandName.charAt(0)}
              </span>
              <span className="text-lg font-semibold tracking-tight text-[#14201c]">{brandName}</span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#5c6b64] sm:mt-5">
              The restaurant operating system for owners who want calmer service, fewer mistakes,
              and revenue they can actually see.
            </p>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a8a82]">
              Explore
            </h3>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:mt-5 sm:block sm:space-y-3 sm:grid-cols-none">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#5c6b64] transition-colors duration-150 ease-out hover:text-[#0f766e]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[#14201c]/[0.08] pt-6 sm:mt-14 sm:flex-row sm:items-center sm:gap-4 sm:pt-8">
          <p className="text-sm text-[#7a8a82]">
            © {new Date().getFullYear()} {brandName}. All rights reserved.
          </p>
          <p className="text-sm text-[#7a8a82]">
            Built by{" "}
            <a
              href={AGENCY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0f766e] underline underline-offset-2 transition-colors duration-150 ease-out hover:text-[#0d9488]"
            >
              BluePeak Studio
            </a>
          </p>
        </div>

        <PlatformPoweredBy className="mt-4 text-[#7a8a82]" />
      </div>
    </footer>
  );
}
