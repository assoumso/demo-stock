
import { useEffect, useState, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  minLength?: number;
}

export const useBarcodeScanner = ({ onScan, minLength = 3 }: UseBarcodeScannerProps) => {
  const [barcode, setBarcode] = useState('');
  const lastKeyTime = useRef<number>(0);
  
  // Seuil de temps entre les frappes pour considérer que c'est un scanner (ms)
  // Les scanners envoient les caractères très rapidement (< 50ms généralement)
  const SCAN_SPEED_THRESHOLD = 50; 

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si l'utilisateur tape dans un input (sauf si c'est le scanner qui écrit dedans, mais on gère le global ici)
      // Si on veut que ça marche même si un input est focus, on peut retirer cette condition, 
      // mais attention aux conflits si l'utilisateur tape manuellement.
      // Pour un scanner "wedge", il simule des frappes clavier.
      
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      // Si on est dans un champ de recherche spécifique au produit, on laisse faire l'input
      // Mais si on veut que le scan fonctionne partout, on doit capturer.
      // Une stratégie courante : détecter la vitesse de frappe.
      
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      lastKeyTime.current = currentTime;

      // Si c'est "Enter", c'est souvent la fin du scan
      if (e.key === 'Enter') {
        if (barcode.length >= minLength) {
            // C'est probablement un scan valide
            e.preventDefault(); // Empêcher le submit du form si on est dans un form
            onScan(barcode);
            setBarcode('');
        } else {
            // Pas assez long, peut-être juste une frappe manuelle
            setBarcode('');
        }
        return;
      }

      // Si caractère imprimable
      if (e.key.length === 1) {
          // Si le délai est court, on ajoute au buffer
          if (timeDiff < SCAN_SPEED_THRESHOLD || barcode.length === 0) {
              setBarcode(prev => prev + e.key);
          } else {
              // Si on tape lentement, on reset le buffer (c'est probablement une saisie manuelle)
              // Sauf si on est au tout début
              setBarcode(e.key); 
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcode, onScan, minLength]);

  return barcode;
};
