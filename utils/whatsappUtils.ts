
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Types pour les paramètres de partage
interface ShareInvoiceParams {
  elementId?: string;
  element?: HTMLElement;
  filename: string;
  phone: string;
  message: string;
}

/**
 * Normalise un numéro de téléphone pour WhatsApp
 * Gère les formats internationaux et locaux (Bénin par défaut)
 */
export const normalizePhoneNumber = (phone: string): string => {
    if (!phone) return '';
    
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '').replace(/\./g, '').replace(/\(/g, '').replace(/\)/g, '');
    
    // Supprimer le préfixe '+' ou '00'
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2);
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    
    // Ajouter l'indicatif Bénin (229) par défaut si le numéro semble être local (8-10 chiffres)
    // et ne commence pas déjà par 229
    // On assume que les numéros locaux font 8 chiffres (ancien format) ou 10 chiffres (nouveau format avec indicatif partiel)
    if ((cleanPhone.length === 8 || cleanPhone.length === 10) && !cleanPhone.startsWith('229')) {
        cleanPhone = '229' + cleanPhone;
    }
    
    return cleanPhone;
};

/**
 * Formate un numéro de téléphone pour l'affichage (ajoute des espaces)
 * Ex: 22901020304 -> +229 01 02 03 04
 */
export const formatPhoneNumberDisplay = (phone: string): string => {
    const clean = normalizePhoneNumber(phone);
    if (clean.length < 8) return phone;
    
    // Si commence par 229 (Bénin)
    if (clean.startsWith('229')) {
        const rest = clean.substring(3);
        // Format +229 XX XX XX XX
        return `+229 ${rest.match(/.{1,2}/g)?.join(' ') || rest}`;
    }
    
    return `+${clean}`;
};

/**
 * Génère et télécharge un fichier vCard (.vcf) pour ajouter un contact
 */
export const downloadVCard = (name: string, phone: string) => {
    const cleanPhone = normalizePhoneNumber(phone);
    
    // Création du contenu vCard standard
    const vCardData = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${name}`, // Full Name
        `TEL;TYPE=CELL:${cleanPhone}`, // Phone Number
        'END:VCARD'
    ].join('\n');

    const blob = new Blob([vCardData], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/\s+/g, '_')}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Génère un PDF à partir d'un élément HTML et tente de le partager
 * Si l'API Web Share n'est pas disponible (Desktop), télécharge le PDF et ouvre WhatsApp Web
 */
export const shareInvoiceViaWhatsapp = async ({ elementId, element, filename, phone, message }: ShareInvoiceParams): Promise<void> => {
    console.log(`🎯 Partage WhatsApp: "${filename}"`);
    
    let targetElement = element || (elementId ? document.getElementById(elementId) : null);
    
    console.log(`🔍 Élément trouvé:`, !!targetElement);
    if (!targetElement) {
        const err = `Element ${elementId ? `#${elementId}` : 'fourni'} introuvable`;
        console.error("❌", err);
        throw new Error(err);
    }

    // Vérifier si l'élément a du contenu réel
    const htmlLength = targetElement.innerHTML?.trim().length || 0;
    console.log("📋 HTML length:", htmlLength);
    
    if (htmlLength < 200) {
        console.warn("⚠️ Élément semble vide, cherche le contenu dans les enfants...");
        const parent = targetElement.parentElement;
        if (parent && parent.innerHTML.length > htmlLength) {
            console.log("✅ Utilise le parent avec plus de contenu");
            targetElement = parent as HTMLElement;
        }
    }
    console.log("🎨 CSS avant:", {
        display: window.getComputedStyle(targetElement).display,
        visibility: window.getComputedStyle(targetElement).visibility,
        opacity: window.getComputedStyle(targetElement).opacity
    });

    // Sauvegarder le style original de l'élément
    const originalDisplay = targetElement.style.display;
    const originalVisibility = targetElement.style.visibility;
    const originalOpacity = targetElement.style.opacity;
    const originalPosition = targetElement.style.position;
    const originalSize = { width: targetElement.style.width, height: targetElement.style.height };

    try {
        // Rendre l'élément visible pour la capture
        console.log("✨ Rendu de l'élément invisible pour la capture...");
        targetElement.style.display = 'block';
        targetElement.style.visibility = 'visible';
        targetElement.style.opacity = '1';
        targetElement.style.position = 'fixed';
        targetElement.style.left = '-9999px';
        targetElement.style.top = '-9999px';
        targetElement.style.width = 'auto';
        targetElement.style.height = 'auto';
        
        // Ajouter au DOM si nécessaire
        if (!targetElement.parentElement) {
            console.log("⚠️ Élément sans parent, ajout au body");
            document.body.appendChild(targetElement);
        }

        // Attendre que le DOM soit mis à jour
        console.log("⏳ Attente du DOM...");
        await new Promise(resolve => setTimeout(resolve, 200));

        // 1. Capture de l'élément en image
        console.log("📸 Capture de l'élément avec html2canvas...");
        if (!window.html2canvas) {
            throw new Error("html2canvas n'est pas chargé sur la page");
        }

        // @ts-ignore - html2canvas global
        const canvas = await window.html2canvas(targetElement, { 
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1200,
            backgroundColor: '#ffffff'
        });
        
        console.log("✅ Canvas généré:", canvas.width, "x", canvas.height);
        const imgData = canvas.toDataURL('image/png');
        console.log("✅ Image data généré:", imgData.substring(0, 50) + "...");
        
        // 2. Création du PDF
        console.log("📄 Création du PDF avec jsPDF...");
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error("jsPDF n'est pas chargé sur la page");
        }

        // @ts-ignore - jspdf types might be tricky with global import
        const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        console.log("📐 Dimensions PDF:", pdfWidth, "x", pdfHeight);
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        const pdfBlob = pdf.output('blob');
        const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

        console.log("✅ PDF créé:", pdfBlob.size, "bytes");

        // 3. Préparation du lien WhatsApp
        const cleanPhone = normalizePhoneNumber(phone);
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        console.log("📱 URL WhatsApp préparée");

        // 4. Tentative de partage natif (Mobile principalement)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            console.log("📤 Tentative de partage natif...");
            try {
                await navigator.share({
                    files: [pdfFile],
                    title: filename,
                    text: message,
                });
                console.log("✅ Partage natif réussi");
                return;
            } catch (error) {
                console.warn("⚠️ Partage natif annulé ou échoué:", error);
            }
        }

        // 5. Fallback Desktop : Téléchargement + Ouverture WhatsApp Web
        console.log("💾 Téléchargement du PDF...");
        pdf.save(filename);
        console.log("🌐 Ouverture de WhatsApp Web...");
        window.open(whatsappUrl, '_blank');
        
        // Petit délai pour laisser le temps au téléchargement de démarrer
        return new Promise((resolve) => {
            setTimeout(() => {
                alert(`La facture "${filename}" a été téléchargée.\n\nVeuillez maintenant la glisser dans la conversation WhatsApp qui vient de s'ouvrir.`);
                resolve();
            }, 500);
        });
    } catch (error: any) {
        console.error('❌ Erreur détaillée lors de la génération du PDF:');
        console.error('  Message:', error.message);
        console.error('  Stack:', error.stack);
        console.error('  Objet complet:', error);
        throw new Error(`Erreur lors de la génération du PDF: ${error.message || error}`);
    } finally {
        // Restaurer le style original de l'élément
        console.log("🔄 Restauration des styles...");
        targetElement.style.display = originalDisplay || '';
        targetElement.style.visibility = originalVisibility || '';
        targetElement.style.opacity = originalOpacity || '';
        targetElement.style.position = originalPosition || '';
        targetElement.style.width = originalSize.width || '';
        targetElement.style.height = originalSize.height || '';
    }
};

