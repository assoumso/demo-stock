
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

// Icône de Supermarché (Caddie stylisé)
const SupermarketIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <path d="M3 3H5L5.4 5M5.4 5H21L17 13H7M5.4 5L7 13M7 13L4.707 15.293C4.077 15.923 4.523 17 5.414 17H17M17 17C15.895 17 15 17.895 15 19C15 20.105 15.895 21 17 21C18.105 21 19 20.105 19 19C19 17.895 18.105 17 17 17ZM9 19C9 20.105 8.105 21 7 21C5.895 21 5 20.105 5 19C5 17.895 5.895 17 7 17C8.105 17 9 17.895 9 19Z" stroke="url(#gold-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <defs>
            <linearGradient id="gold-gradient" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#D4AF37" />
                <stop offset="1" stopColor="#B8860B" />
            </linearGradient>
        </defs>
    </svg>
);

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { companyName, logoUrl } = useTheme();
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'La connexion a échoué.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary-50 px-4 py-12 relative overflow-hidden">
      
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-3xl shadow-2xl dark:bg-gray-800 border border-primary-200 relative z-10">
        
        {/* Header with Icon/Logo */}
        <div className="text-center">
            <div className="mb-8">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo de l'application" className="h-24 mx-auto object-contain" />
              ) : (
                <div className="flex justify-center">
                  <div className="p-4 bg-primary-100 rounded-2xl shadow-inner">
                    <SupermarketIcon className="h-20 w-20" />
                  </div>
                </div>
              )}
            </div>
            <h1 
                className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-700 to-primary-500 uppercase tracking-tight mb-2"
            >
                {companyName}
            </h1>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Système de Gestion & Ventes</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-2">Nom d'utilisateur</label>
                <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ex: admin"
                    className="w-full px-5 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 outline-none transition-all font-medium"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-2">Mot de passe</label>
                <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-5 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 outline-none transition-all font-medium"
                />
            </div>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <p className="text-sm text-red-700 font-bold">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-400 text-white rounded-xl font-black text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 uppercase tracking-wide"
          >
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
            <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 text-center">🔐 Accès Démonstration</p>
                <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Administrateur</p>
                        <p className="text-xs font-black text-primary-700">admin / password</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Utilisateur</p>
                        <p className="text-xs font-black text-primary-700">user / password</p>
                    </div>
                </div>
            </div>
            <div className="text-center">
                <p className="text-xs text-gray-400 font-medium">© {new Date().getFullYear()} {companyName}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
