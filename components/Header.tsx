"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/map", label: "エリアマップ" },
  { href: "/areas", label: "狙い目エリア" },
  { href: "/follow", label: "フォロー選定" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-bold text-gray-800 text-sm">
          Instagram運用支援ツール
        </span>
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
