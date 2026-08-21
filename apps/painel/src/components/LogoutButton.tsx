"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (compact) {
    return (
      <button
        onClick={handleLogout}
        aria-label="Sair"
        title="Sair"
        className="flex size-8 items-center justify-center rounded-lg border border-areia/15 text-areia/60 transition hover:border-areia/30 hover:text-areia"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
          <path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3M15 16l4-4-4-4M19 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-full border border-areia/15 px-4 py-2 text-sm font-medium text-areia/60 transition hover:border-areia/30 hover:text-areia"
    >
      Sair
    </button>
  );
}
