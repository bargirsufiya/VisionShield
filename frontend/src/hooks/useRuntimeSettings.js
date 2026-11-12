import { useEffect, useState } from "react";

import {
  DEFAULT_RANGES,
  getRuntimeSettings,
} from "../data/sensorData";

function useRuntimeSettings() {
  const [settings, setSettings] = useState(DEFAULT_RANGES);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const data = await getRuntimeSettings();
        if (mounted) {
          setSettings({
            ...DEFAULT_RANGES,
            ...data,
          });
        }
      } catch (error) {
        console.error("Error loading runtime settings:", error);
      }
    }

    loadSettings();
    const interval = setInterval(loadSettings, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return settings;
}

export default useRuntimeSettings;
