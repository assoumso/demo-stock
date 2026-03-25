
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../supabase';
import { AppSettings } from '../types';

type ThemeName = 'slate' | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose';
type Palette = { [key: string]: string };
type Themes = Record<ThemeName, Palette>;

const themes: Themes = {
    slate: { '50': '248 250 252', '100': '241 245 249', '200': '226 232 240', '300': '203 213 225', '400': '148 163 184', '500': '100 116 139', '600': '71 85 105', '700': '51 65 85', '800': '30 41 59', '900': '15 23 42', '950': '2 6 23' },
    red: { '50': '254 242 242', '100': '254 226 226', '200': '254 202 202', '300': '252 165 165', '400': '248 113 113', '500': '239 68 68', '600': '220 38 38', '700': '185 28 28', '800': '153 27 27', '900': '127 29 29', '950': '69 10 10' },
    orange: { '50': '255 247 237', '100': '255 237 213', '200': '254 215 170', '300': '253 186 116', '400': '251 146 60', '500': '249 115 22', '600': '234 88 12', '700': '194 65 12', '800': '154 52 18', '900': '124 45 18', '950': '67 20 7' },
    amber: { '50': '255 251 235', '100': '254 243 199', '200': '253 230 138', '300': '252 211 77', '400': '251 191 36', '500': '245 158 11', '600': '217 119 6', '700': '180 83 9', '800': '146 64 14', '900': '120 53 15', '950': '69 26 3' },
    yellow: { '50': '254 252 232', '100': '254 249 195', '200': '254 240 138', '300': '253 224 71', '400': '250 204 21', '500': '234 179 8', '600': '202 138 4', '700': '161 98 7', '800': '133 77 14', '900': '113 63 18', '950': '66 32 6' },
    lime: { '50': '247 254 231', '100': '236 252 203', '200': '217 249 157', '300': '190 242 100', '400': '163 230 53', '500': '132 204 22', '600': '101 163 13', '700': '77 124 15', '800': '63 98 18', '900': '54 83 20', '950': '26 46 5' },
    green: { '50': '240 253 244', '100': '220 252 231', '200': '187 247 208', '300': '134 239 172', '400': '74 222 128', '500': '34 197 94', '600': '22 163 74', '700': '21 128 61', '800': '22 101 52', '900': '20 83 45', '950': '5 46 22' },
    emerald: { '50': '236 253 245', '100': '209 250 229', '200': '167 243 208', '300': '110 231 183', '400': '52 211 153', '500': '16 185 129', '600': '5 150 105', '700': '4 120 87', '800': '6 95 70', '900': '6 78 59', '950': '2 44 34' },
    teal: { '50': '240 253 250', '100': '204 251 241', '200': '167 243 228', '300': '107 231 208', '400': '45 212 191', '500': '20 184 166', '600': '13 148 136', '700': '15 118 110', '800': '17 94 89', '900': '19 78 74', '950': '47 46 4' },
    cyan: { '50': '236 254 255', '100': '207 250 254', '200': '165 243 252', '300': '103 232 249', '400': '34 211 238', '500': '6 182 212', '600': '8 145 178', '700': '14 116 144', '800': '21 94 117', '900': '22 78 99', '950': '51 68 8' },
    sky: { '50': '240 249 255', '100': '224 242 254', '200': '186 230 253', '300': '125 211 252', '400': '56 189 248', '500': '14 165 233', '600': '2 132 199', '700': '3 105 161', '800': '7 89 133', '900': '12 74 110', '950': '47 73 8' },
    blue: { '50': '239 246 255', '100': '219 234 254', '200': '191 219 254', '300': '147 197 253', '400': '96 165 250', '500': '59 130 246', '600': '37 99 235', '700': '29 78 216', '800': '30 64 175', '900': '30 58 138', '950': '37 84 23' },
    indigo: { '50': '238 242 255', '100': '224 231 255', '200': '199 210 254', '300': '165 180 252', '400': '129 140 248', '500': '99 102 241', '600': '79 70 229', '700': '67 56 202', '800': '55 48 163', '900': '49 46 129', '950': '27 75 30' },
    violet: { '50': '245 243 255', '100': '237 233 254', '200': '221 214 254', '300': '196 181 253', '400': '167 139 250', '500': '139 92 246', '600': '124 58 237', '700': '109 40 217', '800': '91 33 182', '900': '76 29 149', '950': '16 101 46' },
    purple: { '50': '250 245 255', '100': '243 232 255', '200': '233 213 255', '300': '216 180 254', '400': '192 132 252', '500': '168 85 247', '600': '147 51 234', '700': '126 34 206', '800': '107 33 168', '900': '88 28 135', '950': '7 100 59' },
    fuchsia: { '50': '253 244 255', '100': '250 232 255', '200': '245 208 254', '300': '240 171 252', '400': '232 121 249', '500': '217 70 239', '600': '192 38 211', '700': '162 28 175', '800': '134 25 143', '900': '112 26 117', '950': '4 78 74' },
    pink: { '50': '253 242 248', '100': '252 231 243', '200': '251 204 228', '300': '249 168 212', '400': '244 114 182', '500': '236 72 153', '600': '219 39 119', '700': '190 24 93', '800': '157 23 77', '900': '131 24 67', '950': '7 36 80' },
    rose: { '50': '255 241 242', '100': '255 228 230', '200': '254 205 211', '300': '253 164 175', '400': '251 113 133', '500': '244 63 94', '600': '225 29 72', '700': '190 18 60', '800': '159 18 57', '900': '136 19 55', '950': '5 25 76' }
};

const applyTheme = (themeName: ThemeName) => {
    const palette = themes[themeName];
    if (!palette) return;
    for (const key in palette) {
        document.documentElement.style.setProperty(`--color-primary-${key}`, palette[key]);
    }
    localStorage.setItem('coul_freres_theme_color', themeName);
};

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  availableThemes: Themes;
  companyName: string;
  logoUrl: string;
  refreshSettings: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Clés de cache dédiées uniquement à ETS-Coulibaly & Frères
  const CACHE_KEY_COMPANY = 'etscf_company_name';
  const CACHE_KEY_LOGO    = 'etscf_logo_url';
  const CACHE_KEY_THEME   = 'etscf_theme_color';
  const COMPANY_DEFAULT   = 'ETS DEMO-STOCKAGES';

  // Lecture instantanée du cache pour éviter tout scintillement
  const getCached = (key: string, fallback: string): string => {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  };

  // useState initialise directement avec la valeur cachée → un seul rendu, pas de flash
  const [theme, setThemeState]        = useState<ThemeName>(() => getCached(CACHE_KEY_THEME, 'teal') as ThemeName);
  const [companyName, setCompanyName]  = useState<string>(()  => getCached(CACHE_KEY_COMPANY, COMPANY_DEFAULT));
  const [logoUrl, setLogoUrl]          = useState<string>(()  => getCached(CACHE_KEY_LOGO, ''));

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  const fetchSettings = async () => {
      try {
          const { data: settings, error } = await supabase
              .from('app_settings')
              .select('*')
              .eq('id', 'app-config')
              .single();
          
          if (settings && !error) {
              const appSettings = settings as AppSettings;
              
              // Sync Theme
              const savedTheme = appSettings.themeColor as ThemeName;
              if (savedTheme && themes[savedTheme]) {
                  setThemeState(savedTheme);
                  applyTheme(savedTheme);
                  try { localStorage.setItem(CACHE_KEY_THEME, savedTheme); } catch {}
              }

              // Sync Company Name — correction auto des anciens noms de démo
              if (appSettings.companyName) {
                  const DEMO_NAMES = ['GROUPSYBA', 'SYBA', 'demo-stock', 'Demo Stock'];
                  const isOldName = DEMO_NAMES.some(old => appSettings.companyName!.includes(old));
                  const finalName = isOldName ? COMPANY_DEFAULT : appSettings.companyName;
                  if (isOldName) await supabase.from('app_settings').update({ companyName: COMPANY_DEFAULT }).eq('id', 'app-config');
                  setCompanyName(finalName);
                  try { localStorage.setItem(CACHE_KEY_COMPANY, finalName); } catch {}
              } else {
                  await supabase.from('app_settings').update({ companyName: COMPANY_DEFAULT }).eq('id', 'app-config');
                  setCompanyName(COMPANY_DEFAULT);
                  try { localStorage.setItem(CACHE_KEY_COMPANY, COMPANY_DEFAULT); } catch {}
              }
              
              // Sync Logo
              if (appSettings.companyLogoUrl) {
                  setLogoUrl(appSettings.companyLogoUrl);
                  try { localStorage.setItem(CACHE_KEY_LOGO, appSettings.companyLogoUrl); } catch {}
              }
          }
      } catch (error) {
          console.error("Erreur chargement thème:", error);
      }
  };

  useEffect(() => {
    // Supprimer les clés d'anciennes applications au 1er démarrage
    const OLD_KEYS = [
        'coul_freres_theme_color', 'coul_freres_company_name',
        'ets_yababou_user', 'app_user_session',
        'groupsyba_user', 'groupsyba_session',
        'demo_stock_user', 'supabase_user',
    ];
    OLD_KEYS.forEach(key => { try { localStorage.removeItem(key); } catch {} });

    // Appliquer immédiatement le thème mis en cache (déjà lu dans useState)
    applyTheme(theme);

    // Mettre à jour en arrière-plan depuis Firebase (silencieux)
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
    logoUrl,
    refreshSettings: fetchSettings 
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
