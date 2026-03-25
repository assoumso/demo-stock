# 📊 Problèmes de Rapports et Solutions

## Problème
"Impossible de charger les données pour les rapports"

## Cause
La table `bank_transactions` n'a pas été créée dans votre base de données Supabase.

## Diagnostic

Trois tables manquaient initalement:
- ✅ `expense_categories` - **maintenant créée automatiquement**
- ✅ `expenses` - **maintenant créée automatiquement**  
- ❌ `bank_transactions` - **MANQUANTE** - cause du problème des rapports

## Solution

### Étape 1: Exécuter la migration

Vous avez deux options:

#### Option A: Utiliser le script d'affichage (recommandé)
```bash
node scripts/showAllMigrations.js
```

Cela affichera tout le SQL à exécuter dans votre terminal.

#### Option B: Manuel via Supabase

1. Ouvrez [https://app.supabase.com/](https://app.supabase.com/)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor** > **New Query**
4. Copiez et exécutez le SQL suivant:

```sql
-- Table Bank Transactions
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    "id" text PRIMARY KEY,
    "date" text,
    "type" text,
    "amount" numeric,
    "description" text,
    "reference" text,
    "createdByUserId" text,
    "category" text,
    "attachmentUrl" text
);

-- RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON public.bank_transactions FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
```

### Étape 2: Vérifier la création

1. Allez dans **Table Editor**
2. Vous devriez voir la table `bank_transactions`

### Étape 3: Rechargez l'application

Rechargez votre navigateur (F5) et les rapports devraient fonctionner correctement.

## ✅ Amélioration de l'Application

J'ai aussi amélioré l'application pour:
- ✅ Fournir de meilleurs messages d'erreur
- ✅ Ajouter des logs détaillés dans la console
- ✅ Éviter les crashs complets si une table manque
- ✅ Afficher des suggestions d'action à l'utilisateur

## 📝 Notes

Si vous continuez à avoir des problèmes:
1. Ouvrez la console du navigateur (F12)
2. Allez dans l'onglet "Console"
3. Partagez les messages d'erreur exactes

Tous les scripts de diagnostic utiles:
- `node scripts/checkReportsTables.js` - Vérifie l'existence des tables
- `node scripts/showAllMigrations.js` - Affiche tout le SQL nécessaire
- `node scripts/checkExpensesTables.js` - Vérifie les tables de dépenses
