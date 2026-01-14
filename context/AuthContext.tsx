
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Role } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { menuConfig } from '../config/menu';

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
    const savedUser = localStorage.getItem('ets_yababou_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('ets_yababou_user');
      }
    }
    setLoading(false);
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.role) return false;
    if (user.role.name.toLowerCase().includes('admin')) return true;
    return user.role.permissions?.includes(permission) || false;
  };

  const login = async (username: string, pass: string) => {
    setLoading(true);
    try {
        let userData: User | null = null;
        let roleData: Role | null = null;

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", username));
            const userQuerySnapshot = await getDocs(q);

            if (!userQuerySnapshot.empty) {
                const userDoc = userQuerySnapshot.docs[0];
                const data = { uid: userDoc.id, ...userDoc.data() } as User;
                
                if (data.password === pass) {
                    userData = data;
                    // Récupérer le rôle
                    if (userData.roleId) {
                        const roleDocSnap = await getDoc(doc(db, "roles", userData.roleId));
                        if (roleDocSnap.exists()) {
                            roleData = { id: roleDocSnap.id, ...roleDocSnap.data() } as Role;
                        }
                    }
                }
            }
        } catch (firestoreError) {
            console.warn("Firestore inaccessible ou non configuré, tentative via comptes par défaut...");
        }

        // Si non trouvé dans Firestore ou erreur, essayer les mocks (admin/password)
        if (!userData) {
            const mockUser = MOCK_USERS.find(u => u.username === username && u.password === pass);
            if (mockUser) {
                const mockRole = MOCK_ROLES.find(r => r.id === mockUser.roleId);
                if (mockRole) {
                    userData = mockUser;
                    roleData = mockRole;
                }
            }
        }

        if (userData && roleData) {
            const authenticatedUser = { ...userData, role: roleData };
            setUser(authenticatedUser);
            localStorage.setItem('ets_yababou_user', JSON.stringify(authenticatedUser));
        } else {
            throw new Error("Identifiants incorrects ou base de données non initialisée.");
        }
    } catch (error: any) {
        throw error;
    } finally {
        setLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
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
