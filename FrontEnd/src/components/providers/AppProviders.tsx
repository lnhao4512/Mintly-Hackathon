"use client";

import type { ReactNode } from "react";
import { WalletContextProvider } from "./WalletProvider";
import { I18nProvider } from "@/lib/i18n";
import { DevnetNotice } from "@/components/layout/DevnetNotice";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Cursor } from "@/components/motion/Cursor";

/**
 * Single entry-point for every client-side provider the app needs.
 *
 * Imported by the root layout (a server component) so that every page
 * gets wallet context without having to wrap anything themselves.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <WalletContextProvider>
        <SmoothScroll>
          <Cursor />
          {children}
          <DevnetNotice />
        </SmoothScroll>
      </WalletContextProvider>
    </I18nProvider>
  );
}
