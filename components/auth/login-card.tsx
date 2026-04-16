"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Role } from "@/lib/types";

type AuthMode = "sign-in" | "register";

function getModeFromSearch(value: string | null): AuthMode {
  return value === "register" ? "register" : "sign-in";
}

export function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(() => getModeFromSearch(searchParams.get("mode")));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("teen");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  useEffect(() => {
    setMode(getModeFromSearch(searchParams.get("mode")));
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          mode === "register"
            ? { name, email, password, role }
            : { email, password }
        )
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(payload.message ?? "Something went wrong. Please try again.");
        return;
      }

      router.replace("/app");
      router.refresh();
    } catch {
      setError("RoadReady could not reach the sign-in service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setError("");
    setIsDemoLoading(true);

    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      const payload = (await response.json()) as {
        message?: string;
        user?: { id: string };
      };

      if (!response.ok || !payload.user) {
        setError(payload.message ?? "RoadReady could not start the demo account.");
        return;
      }

      window.localStorage.removeItem(`roadready-demo-state:${payload.user.id}`);
      window.localStorage.removeItem(`roadready-account-link:${payload.user.id}`);
      window.localStorage.removeItem("roadready-household-state:READY-247");
      router.replace("/app");
      router.refresh();
    } catch {
      setError("RoadReady could not start the demo account.");
    } finally {
      setIsDemoLoading(false);
    }
  }

  return (
    <section className="auth-card">
      <div className="auth-card-header">
        <span className="eyebrow">Secure access</span>
        <h1>{mode === "register" ? "Create your RoadReady account" : "Sign in to RoadReady"}</h1>
        <p className="subtle-text">
          {mode === "register"
            ? "Accounts are stored locally for this demo, then your driving workspace is unlocked behind a real session."
            : "Use the account you created on this device to unlock the protected RoadReady planner."}
        </p>
      </div>

      <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          className={mode === "sign-in" ? "auth-mode-toggle-button active" : "auth-mode-toggle-button"}
          onClick={() => setMode("sign-in")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "register" ? "auth-mode-toggle-button active" : "auth-mode-toggle-button"}
          onClick={() => setMode("register")}
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Jordan Lee" />
          </label>
        ) : null}

        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </label>

        {mode === "register" ? (
          <label>
            <span>Primary view</span>
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="teen">Teen learner</option>
              <option value="parent">Parent / instructor</option>
            </select>
          </label>
        ) : null}

        {error ? <div className="auth-feedback error">{error}</div> : null}

        <button type="submit" className="primary-button auth-submit-button" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "register"
              ? "Creating account..."
              : "Signing in..."
            : mode === "register"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <div className="auth-demo-panel">
        <div>
          <strong>Try the seeded demo account</strong>
          <p className="subtle-text">
            Jump in as Maya Chen and start with the sample driving history, recommendations, and route plan.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button auth-submit-button"
          onClick={handleDemoLogin}
          disabled={isSubmitting || isDemoLoading}
        >
          {isDemoLoading ? "Opening demo..." : "Try demo account"}
        </button>
      </div>

      <div className="auth-card-footer">
        <p>
          {mode === "register" ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="inline-button"
            onClick={() => setMode(mode === "register" ? "sign-in" : "register")}
          >
            {mode === "register" ? "Sign in instead" : "Create an account"}
          </button>
        </p>
        <Link href="/" className="inline-link">
          Back to the overview
        </Link>
      </div>
    </section>
  );
}
