# Guide d'Archivage des Clients

## Vue d'ensemble
La fonction d'archivage permet de "désactiver" des clients sans les supprimer définitivement, préservant ainsi toutes leurs données historiques (ventes, paiements, notes de crédit).

## Fonctionnalités

### 1. Archivage automatique lors de la suppression
- Lorsque vous tentez de supprimer un client qui a des enregistrements liés (ventes, paiements, notes de crédit)
- Le système propose automatiquement d'archiver le client au lieu de le supprimer
- Les données historiques sont préservées

### 2. Archivage manuel
- Dans le formulaire d'édition d'un client, une section "Archivage" est disponible
- Cochez "Archiver ce client" pour le rendre inactif
- Le client devient invisible dans la plupart des vues

### 3. Restauration
- Les clients archivés peuvent être restaurés depuis la liste des clients
- Utilisez le filtre "Clients Archivés" pour les voir
- Cliquez sur "Restaurer" pour les rendre à nouveau actifs

### 4. Filtres et affichage
- **Vue par défaut** : Les clients archivés sont cachés
- **Filtre "Clients Archivés"** : Affiche uniquement les clients archivés
- **Indicateur visuel** : Les clients archivés ont un badge "Archivé" dans la liste

## Impact sur les autres fonctionnalités

### Points de Vente (POS)
- Les clients archivés n'apparaissent pas dans la liste déroulante des clients
- Cela évite les erreurs de sélection lors de nouvelles ventes

### Formulaire des Ventes
- Les clients archivés ne sont pas proposés dans la recherche de clients
- Cela garantit que seuls les clients actifs peuvent faire de nouvelles commandes

### Compte Client
- Les comptes de clients archivés restent accessibles via l'URL directe
- Vous pouvez consulter l'historique et les soldes des clients archivés

## Champs d'archivage ajoutés
- `isArchived` (boolean) : Indique si le client est archivé
- `archivedAt` (datetime) : Date et heure de l'archivage
- `archivedBy` (string) : ID de l'utilisateur ayant effectué l'archivage

## Migration SQL
La migration SQL nécessaire est disponible dans : `migrations/add_customer_archive_fields.sql`

## Bonnes pratiques
1. **Archiver plutôt que supprimer** : Préserve l'intégrité historique des données
2. **Vérifier les dépendances** : Le système vérifie automatiquement les enregistrements liés
3. **Restauration possible** : Les clients archivés peuvent être restaurés si nécessaire
4. **Consultation historique** : Les données des clients archivés restent consultables