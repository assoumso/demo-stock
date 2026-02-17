import React from 'react';
import { useAuth } from '../hooks/useAuth';

const SimpleAdjustmentsTest: React.FC = () => {
  const { user, hasPermission } = useAuth();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Test de la Page des Ajustements</h1>
      
      {/* Section d'information utilisateur */}
      <div className="bg-blue-50 dark:bg-blue-900 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Informations Utilisateur</h2>
        {user ? (
          <div>
            <p><strong>Utilisateur:</strong> {user.displayName} ({user.username})</p>
            <p><strong>Rôle:</strong> {user.role?.name || 'Aucun rôle'}</p>
            <p><strong>Permission inventory:adjustments:</strong> 
              <span className={hasPermission('inventory:adjustments') ? 'text-green-600' : 'text-red-600'}>
                {hasPermission('inventory:adjustments') ? '✅ ACCORDÉE' : '❌ REFUSÉE'}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-red-600">🔒 Aucun utilisateur connecté</p>
        )}
      </div>

      {/* Lien vers la page officielle */}
      <div className="bg-green-50 dark:bg-green-900 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Accès à la page des ajustements</h2>
        <p className="mb-4">Cliquez sur le lien ci-dessous pour accéder à la page officielle des ajustements :</p>
        <a 
          href="/#/inventory/adjustments" 
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          📊 Accéder à la page des ajustements
        </a>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 dark:bg-yellow-900 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Connectez-vous avec un compte manager (admin/password)</li>
          <li>Cliquez sur le lien ci-dessus pour accéder à la page des ajustements</li>
          <li>Si la permission est accordée, la page devrait s'afficher normalement</li>
          <li>Si la permission est refusée, vérifiez le rôle de l'utilisateur</li>
        </ol>
      </div>
    </div>
  );
};

export default SimpleAdjustmentsTest;