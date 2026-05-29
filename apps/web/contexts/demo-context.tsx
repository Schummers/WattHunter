"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

interface DemoContextValue {
  isDemo: boolean;
  visitorTeamId: string | null;
  triggerPulse: () => void;
  registerPulseTarget: (el: HTMLElement | null) => void;
}

const DEFAULT_VALUE: DemoContextValue = {
  isDemo: false,
  visitorTeamId: null,
  triggerPulse: () => {},
  registerPulseTarget: () => {},
};

const DemoContext = createContext<DemoContextValue>(DEFAULT_VALUE);

export interface DemoProviderProps {
  visitorTeamId: string;
  children: ReactNode;
}

export function DemoProvider({ visitorTeamId, children }: DemoProviderProps) {
  const targetRef = useRef<HTMLElement | null>(null);

  const triggerPulse = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.classList.remove("demo-pulse");
    void el.offsetWidth;
    el.classList.add("demo-pulse");
  }, []);

  const registerPulseTarget = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({ isDemo: true, visitorTeamId, triggerPulse, registerPulseTarget }),
    [visitorTeamId, triggerPulse, registerPulseTarget],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  return useContext(DemoContext);
}

/**
 * Wraps a mutation server-action invocation.
 *
 * Outside demo mode → returns `fn` unchanged.
 * Inside demo mode  → returns a no-op that triggers the banner pulse and
 *                     resolves to `{ blocked: true }` so callers can early-out.
 */
export function useDemoSafeAction<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn> | TReturn,
): (...args: TArgs) => Promise<TReturn | { blocked: true }> {
  const { isDemo, triggerPulse } = useDemo();
  return useCallback(
    async (...args: TArgs) => {
      if (isDemo) {
        triggerPulse();
        return { blocked: true };
      }
      return await fn(...args);
    },
    [isDemo, triggerPulse, fn],
  );
}
