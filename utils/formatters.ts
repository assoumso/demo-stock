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

export const formatDate = (date: string | Date | undefined): string => {
  if (!date) return '-';
  
  // If it's a simple YYYY-MM-DD string, format it directly to avoid timezone issues
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
     const [year, month, day] = date.split('-');
     return `${day}/${month}/${year}`;
  }
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  // Force dd/mm/yyyy format manually
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

export const formatDateLong = (date: string | Date | undefined): string => {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
};

export const formatDateTime = (date: string | Date | undefined): string => {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
};

export default formatCurrency;