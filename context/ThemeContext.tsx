
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { AppSettings } from '../types';

type ThemeName = 'amber' | 'teal' | 'sky' | 'rose';
type Palette = { [key: string]: string };
type Themes = Record<ThemeName, Palette>;

const themes: Themes = {
    amber: {
        '50': '255 251 235', '100': '254 243 199', '200': '253 230 138',
        '300': '252 211 77', '400': '251 191 36', '500': '245 158 11',
        '600': '217 119 6', '700': '180 83 9', '800': '146 64 14',
        '900': '120 53 15', '950': '69 26 3'
    },
    teal: {
        '50': '240 253 250', '100': '204 251 241', '200': '167 243 228',
        '300': '107 231 208', '400': '45 212 191', '500': '20 184 166',
        '600': '13 148 136', '700': '15 118 110', '800': '17 94 89',
        '900': '19 78 74', '950': '4 47 46'
    },
    sky: {
        '50': '240 249 255', '100': '224 242 254', '200': '186 230 253',
        '300': '125 211 252', '400': '56 189 248', '500': '14 165 233',
        '600': '2 132 199', '700': '3 105 161', '800': '7 89 133',
        '900': '12 74 110', '950': '8 47 73'
    },
    rose: {
        '50': '255 241 242', '100': '255 228 230', '200': '254 205 211',
        '300': '253 164 175', '400': '251 113 133', '500': '244 63 94',
        '600': '225 29 72', '700': '190 18 60', '800': '159 18 57',
        '900': '136 19 55', '950': '76 5 25'
    }
};

const applyTheme = (themeName: ThemeName) => {
    const palette = themes[themeName];
    if (!palette) return;
    for (const key in palette) {
        document.documentElement.style.setProperty(`--color-primary-${key}`, palette[key]);
    }
    // Mise en cache synchrone pour le head du HTML
    localStorage.setItem('app_theme_color', themeName);
};

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  availableThemes: Themes;
  companyName: string;
  refreshSettings: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Récupération synchrone immédiate pour éviter le flash
  const [theme, setTheme] = useState<ThemeName>(() => {
    const cached = localStorage.getItem('app_theme_color') as ThemeName;
    return (cached && themes[cached]) ? cached : 'amber';
  });

  const [companyName, setCompanyName] = useState<string>(() => {
    return localStorage.getItem('app_company_name') || 'ETS-DEMO';
  });

  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
      try {
          const settingsDocRef = doc(db, 'settings', 'app-config');
          const settingsSnap = await getDoc(settingsDocRef);
          if (settingsSnap.exists()) {
              const settings = settingsSnap.data() as AppSettings;
              
              // Appliquer et mettre en cache le thème
              const savedTheme = settings.themeColor as ThemeName;
              if (savedTheme && themes[savedTheme]) {
                  setTheme(savedTheme);
                  localStorage.setItem('app_theme_color', savedTheme);
              }

              // Appliquer et mettre en cache le nom
              if (settings.companyName) {
                  setCompanyName(settings.companyName);
                  localStorage.setItem('app_company_name', settings.companyName);
              }
          }
      } catch (error) {
          console.warn("Erreur chargement paramètres, utilisation du cache.");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme,
    availableThemes: themes,
    companyName,
    refreshSettings: fetchSettings
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
