export const formatCurrency = (value: number | string | undefined, currency: string = 'FCFA'): string => {
  const numValue = Number(value) || 0;
  
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numValue);
  
  // Remplacer les espaces normaux par des espaces insécables pour éviter les problèmes d'affichage
  return formatted.replace(/\s/g, '\u00A0') + ` ${currency}`;
};

export const formatNumber = (value: number | string | undefined): string => {
  const numValue = Number(value) || 0;
  
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numValue).replace(/\s/g, '\u00A0');
};

export default formatCurrency;