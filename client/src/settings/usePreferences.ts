import { useCallback, useEffect, useState } from 'react';
import { defaultPreferences, loadPreferences, savePreferences, type Preferences } from './preferences';

export type UpdatePreferences = <K extends keyof Preferences>(section: K, value: Partial<Preferences[K]>) => void;

export function usePreferences() {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [saved, setSaved] = useState<boolean | null>(null);
  useEffect(() => { setSaved(savePreferences(preferences)); }, [preferences]);

  const update: UpdatePreferences = useCallback((section, value) => {
    setPreferences((current) => ({ ...current, [section]: { ...current[section], ...value } }));
  }, []);
  const resetSettings = useCallback(() => {
    setPreferences((current) => ({ ...defaultPreferences(), profile: current.profile, match: current.match }));
  }, []);
  return { preferences, update, resetSettings, saved };
}
