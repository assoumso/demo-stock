import React from 'react';
import { DebugPermissions } from '../components/DebugPermissions';

const TestAdjustmentsPage: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Page de Test - Ajustements</h1>
      <DebugPermissions />
      
      <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Contenu de la page des ajustements</h2>
        <p>Si vous voyez ce message et le débogage ci-dessus, la page fonctionne!</p>
        <p className="mt-2">La permission 'inventory:adjustments' devrait être accordée pour les managers.</p>
      </div>
    </div>
  );
};

export default TestAdjustmentsPage;