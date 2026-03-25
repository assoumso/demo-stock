
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Version de l'application - changez ceci pour forcer le nettoyage du cache
const APP_VERSION = '1.0.2';
const VERSION_KEY = 'app_version_cache_clear';

try {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  // Si la version stockée est différente de la version actuelle, on nettoie tout
  if (storedVersion !== APP_VERSION) {
    console.log('Mise à jour détectée ou nettoyage demandé. Suppression du cache...');
    
    // Sauvegarder éventuellement des préférences si nécessaire, sinon on nettoie tout
    localStorage.clear();
    sessionStorage.clear();
    
    // Nettoyage des cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // On définit la nouvelle version
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    
    console.log('Cache nettoyé avec succès.');
  }
} catch (error) {
  console.error('Erreur lors du nettoyage du cache:', error);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);