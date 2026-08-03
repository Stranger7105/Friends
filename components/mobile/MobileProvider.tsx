"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type MobileContextType = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
};

const MobileContext = createContext<MobileContextType>({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
});

export function MobileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(1920);

  useEffect(() => {
    function update() {
      setWidth(window.innerWidth);
    }

    update();

    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  const value = useMemo(
    () => ({
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1100,
      isDesktop: width >= 1100,
    }),
    [width]
  );

  return (
    <MobileContext.Provider value={value}>
      {children}
    </MobileContext.Provider>
  );
}

export function useMobile() {
  return useContext(MobileContext);
}