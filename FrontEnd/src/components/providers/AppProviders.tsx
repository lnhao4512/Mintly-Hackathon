"use client";

import type { ReactNode } from "react";
import { WalletContextProvider } from "./WalletProvider";
import { I18nProvider } from "@/lib/i18n";

/**
 * Single entry-point for every client-side provider the app needs.
 *
 * Imported by the root layout (a server component) so that every page
 * gets wallet context without having to wrap anything themselves.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <WalletContextProvider>{children}</WalletContextProvider>
    </I18nProvider>
  );
}
