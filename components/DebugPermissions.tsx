import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const DebugPermissions: React.FC = () => {
  const { user, hasPermission } = useAuth();

  if (!user) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#ffebee', border: '1px solid #f44336', margin: '10px' }}>
        <h3>🔒 Aucun utilisateur connecté</h3>
        <p>Veuillez vous connecter pour accéder aux fonctionnalités.</p>
      </div>
    );
  }

  const permissionsToTest = [
    'dashboard',
    'inventory',
    'inventory:adjustments',
    'products',
    'sales'
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#e8f5e8', border: '1px solid #4caf50', margin: '10px' }}>
      <h3>🔍 Informations de débogage</h3>
      <div style={{ marginBottom: '15px' }}>
        <strong>Utilisateur:</strong> {user.displayName} ({user.username})
        <br />
        <strong>Rôle:</strong> {user.role?.name || 'Aucun rôle'}
        <br />
        <strong>ID du rôle:</strong> {user.roleId || 'Aucun ID'}
      </div>
      
      <div>
        <h4>Permissions testées:</h4>
        {permissionsToTest.map(permission => (
          <div key={permission} style={{ margin: '5px 0' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '150px',
              fontWeight: 'bold'
            }}>
              {permission}:
            </span>
            <span style={{ 
              color: hasPermission(permission) ? '#4caf50' : '#f44336',
              fontWeight: 'bold'
            }}>
              {hasPermission(permission) ? '✅ ACCORDÉE' : '❌ REFUSÉE'}
            </span>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        <p><strong>Permissions complètes du rôle:</strong></p>
        <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(user.role?.permissions || [], null, 2)}
        </pre>
      </div>
    </div>
  );
};