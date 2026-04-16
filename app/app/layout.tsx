import type { Route } from "next";
import { redirect } from "next/navigation";
import { AppStateProvider } from "@/components/app-state";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function ProductLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const account = await getCurrentUser();

  if (!account) {
    redirect("/login" as Route);
  }

  return (
    <AppStateProvider account={account}>
      <AppShell>{children}</AppShell>
    </AppStateProvider>
  );
}
