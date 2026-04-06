import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Howl } from "howler";
import {
  DEFAULT_NOTIFICATION_SOUND,
  getNotificationSoundUrl,
  NOTIFICATION_SOUND_OPTIONS,
} from "@/lib/notificationSounds";

const ThemeContext = createContext();

const DEFAULT_BRANDING = {
  platformName: "ZapAI",
  primaryColor: "#22c55e",
  secondaryColor: "#f59e0b",
  logoUrl: "",
};

function hexToHSL(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem("darkMode");
      return stored == null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const [branding, setBrandingState] = useState(() => {
    try {
      const stored = localStorage.getItem("branding");
      return stored
        ? { ...DEFAULT_BRANDING, ...JSON.parse(stored) }
        : DEFAULT_BRANDING;
    } catch {
      return DEFAULT_BRANDING;
    }
  });
  const [notificationSound, setNotificationSoundState] = useState(() => {
    try {
      return (
        localStorage.getItem("notificationSound") || DEFAULT_NOTIFICATION_SOUND
      );
    } catch {
      return DEFAULT_NOTIFICATION_SOUND;
    }
  });
  const notificationPlayerRef = useRef(null);

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", darkMode.toString());
  }, [darkMode]);

  // Apply primary + secondary color as CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (
      branding.primaryColor &&
      /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor)
    ) {
      const hsl = hexToHSL(branding.primaryColor);
      const hslStr = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
      root.style.setProperty("--primary", hslStr);
      root.style.setProperty("--ring", hslStr);
      root.style.setProperty("--chart-1", hslStr);
      root.style.setProperty("--sidebar-primary", hslStr);
      root.style.setProperty("--sidebar-ring", hslStr);
      // Accent based on primary
      const accentL = darkMode ? "15" : "94";
      const accentS = Math.max(hsl.s - 20, 10);
      root.style.setProperty("--accent", `${hsl.h} ${accentS}% ${accentL}%`);
      const accentFgL = darkMode ? "60" : "30";
      root.style.setProperty(
        "--accent-foreground",
        `${hsl.h} ${hsl.s}% ${accentFgL}%`,
      );
    }
    if (
      branding.secondaryColor &&
      /^#[0-9a-fA-F]{6}$/.test(branding.secondaryColor)
    ) {
      const hsl2 = hexToHSL(branding.secondaryColor);
      root.style.setProperty("--chart-2", `${hsl2.h} ${hsl2.s}% ${hsl2.l}%`);
    }
  }, [branding.primaryColor, branding.secondaryColor, darkMode]);

  useEffect(() => {
    const soundUrl = getNotificationSoundUrl(notificationSound);

    localStorage.setItem("notificationSound", notificationSound);

    if (!soundUrl) {
      notificationPlayerRef.current?.unload();
      notificationPlayerRef.current = null;
      return undefined;
    }

    const player = new Howl({
      src: [soundUrl],
      volume: 0.6,
      preload: true,
    });

    notificationPlayerRef.current?.unload();
    notificationPlayerRef.current = player;

    return () => {
      if (notificationPlayerRef.current === player) {
        notificationPlayerRef.current = null;
      }
      player.unload();
    };
  }, [notificationSound]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const setBranding = useCallback((updater) => {
    setBrandingState((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      localStorage.setItem("branding", JSON.stringify(next));
      return next;
    });
  }, []);

  const resetBranding = useCallback(() => {
    setBrandingState(DEFAULT_BRANDING);
    localStorage.setItem("branding", JSON.stringify(DEFAULT_BRANDING));
    const root = document.documentElement;
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--chart-1");
    root.style.removeProperty("--chart-2");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-ring");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-foreground");
  }, []);

  const setNotificationSound = useCallback((soundId) => {
    const nextSound = NOTIFICATION_SOUND_OPTIONS.some(
      (sound) => sound.id === soundId,
    )
      ? soundId
      : DEFAULT_NOTIFICATION_SOUND;

    setNotificationSoundState(nextSound);
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!notificationPlayerRef.current) return;
    notificationPlayerRef.current.stop();
    notificationPlayerRef.current.play();
  }, []);

  // Load branding from company profile (called after login)
  const loadCompanyBranding = useCallback(
    (company) => {
      if (!company) return;
      const updates = {};
      if (company.name) updates.platformName = company.name;
      if (company.logo) updates.logoUrl = company.logo;
      if (company.primaryColor) updates.primaryColor = company.primaryColor;
      if (company.secondaryColor)
        updates.secondaryColor = company.secondaryColor;
      if (Object.keys(updates).length > 0) {
        setBranding((prev) => ({ ...prev, ...updates }));
      }
    },
    [setBranding],
  );

  return (
    <ThemeContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        branding,
        setBranding,
        resetBranding,
        notificationSound,
        setNotificationSound,
        notificationSoundOptions: NOTIFICATION_SOUND_OPTIONS,
        playNotificationSound,
        loadCompanyBranding,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
