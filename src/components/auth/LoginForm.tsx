"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(payload?.error ?? "Connexion impossible.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nom de compte ou mot de passe incorrect.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={submitLogin}>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nom de compte
        <input
          autoComplete="username"
          className="h-11 rounded-lg border border-zinc-300 px-3 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          name="username"
          required
          type="text"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Mot de passe
        <input
          autoComplete="current-password"
          className="h-11 rounded-lg border border-zinc-300 px-3 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          name="password"
          required
          type="password"
        />
      </label>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="h-11 rounded-lg bg-zinc-950 px-4 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
