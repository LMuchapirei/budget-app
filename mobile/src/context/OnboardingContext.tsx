import React, { createContext, useContext } from 'react';

interface OnboardingContextValue {
  replay: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  replay: () => {},
});

export function OnboardingProvider({
  replay,
  children,
}: {
  replay: () => void;
  children: React.ReactNode;
}) {
  return (
    <OnboardingContext.Provider value={{ replay }}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
