"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);
    await fetch("/api/logout", {
      method: "POST",
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className="h-10 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 transition hover:bg-white disabled:cursor-not-allowed disabled:text-zinc-400"
      disabled={isLoggingOut}
      onClick={logout}
      type="button"
    >
      {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
    </button>
  );
}
