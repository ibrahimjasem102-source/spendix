"use client";

import { useCallback, useEffect, useState } from "react";

export interface PhoneContact {
  name: string;
  phone: string | null;
  email: string | null;
}

// Contact Picker API types
interface ContactsManager {
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>>;
}

function getContactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return nav.contacts ?? null;
}

export function usePhoneContactPicker() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(getContactsManager() !== null);
  }, []);

  const pick = useCallback(async (multiple = false): Promise<PhoneContact[]> => {
    const mgr = getContactsManager();
    if (!mgr) return [];
    try {
      const results = await mgr.select(["name", "tel", "email"], { multiple });
      return results
        .map((c) => ({
          name: c.name?.[0]?.trim() ?? "",
          phone: c.tel?.[0]?.trim() ?? null,
          email: c.email?.[0]?.trim() ?? null,
        }))
        .filter((c) => c.name.length > 0);
    } catch {
      return [];
    }
  }, []);

  return { isSupported, pick };
}
