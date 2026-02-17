// config/permissions.ts

export const permissionConfig = [
  {
    group: 'Tableau de bord',
    permissions: [
      { id: 'dashboard', name: "Voir le tableau de bord" },
    ],
  },
  {
    group: 'Point de Vente (POS)',
    permissions: [
      { id: 'pos', name: "Accéder au Point de Vente" },
    ],
  },
  {
    group: 'Ventes',
    permissions: [
      { id: 'sales', name: "Voir la liste des ventes" },
      { id: 'sales:create', name: "Créer une vente" },
      { id: 'sales:edit', name: "Modifier une vente" },
      { id: 'sales:delete', name: "Supprimer une vente" },
      { id: 'sales:invoice', name: "Voir la facture de vente" },
      { id: 'sales:payments', name: "Gérer les paiements de vente" },
    ],
  },
  {
    group: 'Achats',
    permissions: [
      { id: 'purchases', name: "Voir la liste des achats" },
      { id: 'purchases:create', name: "Créer un achat" },
      { id: 'purchases:edit', name: "Modifier un achat" },
      { id: 'purchases:delete', name: "Supprimer un achat" },
      { id: 'purchases:invoice', name: "Voir la facture d'achat" },
      { id: 'purchases:payments', name: "Gérer les paiements d'achat" },
    ],
  },
  {
    group: 'Produits',
    permissions: [
      { id: 'products', name: "Voir la liste des produits" },
      { id: 'products:create', name: "Créer un produit" },
      { id: 'products:edit', name: "Modifier un produit" },
      { id: 'products:delete', name: "Supprimer un produit" },
    ],
  },
  {
    group: 'Stocks',
    permissions: [
      { id: 'inventory', name: "Voir les stocks" },
      { id: 'inventory:adjustments', name: "Faire des ajustements de stock" },
    ],
  },
  {
    group: 'Transferts',
    permissions: [
        { id: 'transfers', name: "Gérer les transferts de stock" },
    ]
  },
  {
    group: 'Relations',
    permissions: [
      { id: 'customers', name: "Gérer les clients (Créer, Modifier, Supprimer)" },
      { id: 'suppliers', name: "Gérer les fournisseurs (Créer, Modifier, Supprimer)" },
    ],
  },
  {
    group: 'Rapports',
    permissions: [
      { id: 'reports', name: "Accéder à la page des rapports" },
      { id: 'reports:profit', name: "Voir le rapport de marge (profits)" },
      { id: 'reports:sales', name: "Voir le rapport des ventes" },
      { id: 'reports:services', name: "Voir le rapport des services" },
      { id: 'reports:stock_alert', name: "Voir le rapport d'alerte de stock" },
      { id: 'reports:inventory_value', name: "Voir le rapport de valeur du stock" },
    ],
  },
  {
    group: 'Trésorerie',
    permissions: [
      { id: 'bank', name: "Gérer la Banque (Opérations)" },
    ],
  },
  {
    group: 'Configuration',
    permissions: [
      { id: 'users', name: "Gérer les utilisateurs (Créer, Modifier, Supprimer)" },
      { id: 'roles', name: "Gérer les rôles et permissions" },
      { id: 'warehouses', name: "Gérer les entrepôts" },
      { id: 'brands', name: "Gérer les marques" },
      { id: 'categories', name: "Gérer les catégories" },
      { id: 'units', name: "Gérer les unités" },
      { id: 'settings', name: "Accéder aux paramètres" },
    ],
  },
];