import { Plus_Jakarta_Sans } from "next/font/google";
import "@/features/menu/components/public-menu.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export default function CustomerOrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`public-menu-root ${jakarta.variable}`}>
      {children}
    </div>
  );
}
