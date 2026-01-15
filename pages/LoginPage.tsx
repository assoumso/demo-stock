
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { LogoIcon } from '../constants';

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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
        <div className="text-center overflow-hidden">
            <div className="bg-primary-50 dark:bg-primary-900/30 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shrink-0 overflow-hidden">
                {logoUrl ? (
                    <img 
                        src={logoUrl} 
                        alt="Logo" 
                        className="max-w-full max-h-full object-contain p-1" 
                    />
                ) : (
                    <LogoIcon className="w-12 h-12 text-primary-600"/>
                )}
            </div>
            <h1 
                className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight truncate px-2"
                title={companyName}
            >
                {companyName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Système de Gestion POS & Stocks</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nom d'utilisateur</label>
            <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: admin"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
            <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white outline-none transition-all"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold shadow-lg hover:bg-primary-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t dark:border-gray-700">
            <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest mb-3">Informations d'accès</p>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl text-[11px] text-gray-500 dark:text-gray-400 italic leading-relaxed">
                Utilisez vos identifiants fournis ou l'accès administrateur par défaut : <br/>
                <span className="font-bold text-primary-600 dark:text-primary-400 not-italic">Compte : admin / Passe : password</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
