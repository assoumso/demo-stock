
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Role } from '../types';
import { supabase } from '../supabase';

const MOCK_ROLES: Role[] = [
    { id: 'admin-role', name: 'Administrateur', permissions: [] },
    { 
      id: 'manager-role', 
      name: 'Manager', 
      permissions: [
        'dashboard', 'pos', 'sales', 'products', 'inventory', 'purchases', 'transfers', 
        'customers', 'suppliers', 'reports', 'inventory:adjustments', 
        'sales:create', 'sales:edit', 'sales:delete', 'sales:invoice', 'sales:payments',
        'purchases:create', 'purchases:edit', 'purchases:delete', 'purchases:invoice', 'purchases:payments',
        'products:create', 'products:edit', 'products:delete',
        'reports:profit', 'reports:sales', 'reports:stock_alert'
      ],
      warehouseIds: ['wh1'] 
    },
];

const MOCK_USERS: User[] = [
    { uid: 'mock-admin-uid', username: 'admin', displayName: 'Administrateur', password: 'password', roleId: 'admin-role' },
    { uid: 'mock-user-uid', username: 'user', displayName: 'Utilisateur', password: 'password', roleId: 'manager-role' }
];

type AuthenticatedUser = User & { role: Role };

interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger la session sauvegardée au démarrage
  useEffect(() => {
    // Changement de clé de stockage pour éviter les conflits avec l'ancienne application
    const savedUser = localStorage.getItem('coul_freres_user_session'); 
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser) {
           setUser(parsedUser);
        }
      } catch (e) {
        localStorage.removeItem('coul_freres_user_session');
      }
    }
    
    // Nettoyer toutes les anciennes clés de cache d'autres applications au démarrage
    const OLD_SESSION_KEYS = [
        'ets_yababou_user',
        'app_user_session',
        'groupsyba_user',
        'groupsyba_session',
        'demo_stock_user',
        'supabase_user',
        'supabase_auth',
        'sb-fir-stockage-bdf18-auth-token',
    ];
    OLD_SESSION_KEYS.forEach(key => localStorage.removeItem(key));
    
    // Supprimer aussi toutes les clés sessionStorage des autres apps
    try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.includes('groupsyba') || key.includes('supabase') || key.includes('demo_stock')) {
                sessionStorage.removeItem(key);
            }
        });
    } catch(e) { /* ignoré */ }
    
    setLoading(false);
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.role) return false;
    if (user.role.name.toLowerCase().includes('admin')) return true;
    return user.role.permissions?.includes(permission) || false;
  };

  const login = async (username: string, pass: string) => {
    setLoading(true);
    let userData: User | null = null;
    let roleData: Role | null = null;
    
    try {
        console.log(`Tentative de connexion pour: ${username}`);

        // 1. Essayer avec les utilisateurs en dur (MOCK_USERS) d'abord pour garantir l'accès admin
        const mockUser = MOCK_USERS.find(u => u.username === username && u.password === pass);
        if (mockUser) {
            console.log("Utilisateur trouvé dans les mocks (admin secours)");
            userData = mockUser;
            // Créer un rôle admin complet pour le mock
            roleData = { 
                id: 'admin-role', 
                name: 'Administrateur', 
                permissions: ['all'] // Permission spéciale ou liste complète
            };
        } 
        else {
            // 2. Sinon chercher dans Supabase
            try {
                const { data: userRecord, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .single();

                if (userError) {
                    console.error("Erreur recherche utilisateur Supabase:", userError);
                } else if (userRecord && userRecord.password === pass) {
                    userData = { ...userRecord, uid: userRecord.id } as User;
                    
                    // Récupérer le rôle
                    if (userData.roleId) {
                        const { data: roleRecord, error: roleError } = await supabase
                            .from('roles')
                            .select('*')
                            .eq('id', userData.roleId)
                            .single();
                        
                        if (!roleError && roleRecord) {
                            roleData = roleRecord as Role;
                        }
                    }
                }
            } catch (supabaseError) {
                console.error("Erreur connexion Supabase:", supabaseError);
            }
        }

        if (userData) {
            // Si pas de rôle trouvé mais utilisateur valide, donner un rôle par défaut limité
            if (!roleData) {
                console.warn("Aucun rôle trouvé, attribution rôle par défaut");
                roleData = { id: 'temp-guest', name: 'Invité', permissions: [] };
            }

            const authenticatedUser = { ...userData, role: roleData };
            console.log("Connexion réussie:", authenticatedUser);
            
            setUser(authenticatedUser);
            localStorage.setItem('coul_freres_user_session', JSON.stringify(authenticatedUser));
            return;
        }

        throw new Error("Nom d'utilisateur ou mot de passe incorrect");
    } catch (error) {
        console.error("Erreur finale login:", error);
        throw error;
    } finally {
        setLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('coul_freres_user_session');
    // Clear legacy data just in case
    localStorage.removeItem('app_user_session');
    localStorage.removeItem('ets_yababou_user');
  };

  const value = { user, loading, login, logout, hasPermission };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
