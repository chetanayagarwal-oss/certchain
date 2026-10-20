import React, { createContext, useContext, useState, ReactNode } from "react";

type DemoContextType = {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  demoAddress: string;
};

const DEMO_ADDRESS = "0xDEMO0000000000000000000000000000000000001";

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  toggleDemoMode: () => {},
  demoAddress: DEMO_ADDRESS,
});

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const toggleDemoMode = () => setIsDemoMode((v) => !v);
  return (
    <DemoContext.Provider value={{ isDemoMode, toggleDemoMode, demoAddress: DEMO_ADDRESS }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoContext);
}
