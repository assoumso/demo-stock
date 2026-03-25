
import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { Customer } from '../types';
import { ArrowLeftIcon } from '../constants';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { normalizePhoneNumber, formatPhoneNumberDisplay } from '../utils/whatsappUtils';

const CustomerFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshData } = useData();
    const { addToast } = useToast();
    const isEditing = !!id;
    const returnTo = location.state?.returnTo;

    const [formState, setFormState] = useState<Partial<Customer>>({
        id: '',
        name: '',
        email: '',
        phone: '',
        businessName: '',
        contactPerson: '',
        address: '',
        city: '',
        nif: '',
        rccm: '',
        website: '',
        notes: '',
        isCreditLimited: false,
        creditLimit: 0,
        openingBalance: 0,
        openingBalanceDate: new Date().toISOString().split('T')[0]
    });

    const [loading, setLoading] = useState(isEditing);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isEditing) {
            if (!id) return;
            const fetchCustomer = async () => {
                try {
                    const { data, error: fetchError } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('id', id)
                        .single();
                    
                    if (data && !fetchError) {
                        setFormState(data as Customer);
                    } else {
                        setError("Client non trouvé.");
                    }
                } catch (err) {
                    setError("Erreur lors du chargement.");
                } finally {
                    setLoading(false);
                }
            };
            fetchCustomer();
        }
    }, [id, isEditing]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        if (type === 'checkbox') {
            setFormState(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            const isNumber = ['creditLimit', 'openingBalance'].includes(name);
            setFormState(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
        }
    };

    const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Permettre uniquement les chiffres, espaces et +
        const cleanValue = value.replace(/[^0-9\s+]/g, '');
        setFormState(prev => ({ ...prev, whatsapp: cleanValue }));
    };

    const handleWhatsappBlur = () => {
        // Au moment où l'utilisateur quitte le champ, on formate
        if (formState.whatsapp) {
            const formatted = formatPhoneNumberDisplay(formState.whatsapp);
            setFormState(prev => ({ ...prev, whatsapp: formatted }));
        }
    };

    const generateCustomerDetails = () => {
        return (
            <div className="space-y-2">
                <div className="font-semibold text-xs text-blue-700 dark:text-blue-400">Informations du client:</div>
                {formState.name && <div className="flex justify-between text-xs border-b border-gray-300 dark:border-gray-600 pb-1">
                    <span>Nom:</span>
                    <span className="font-semibold">{formState.name}</span>
                </div>}
                {formState.phone && <div className="flex justify-between text-xs border-b border-gray-300 dark:border-gray-600 pb-1">
                    <span>Téléphone:</span>
                    <span className="font-semibold">{formState.phone}</span>
                </div>}
                {formState.city && <div className="flex justify-between text-xs border-b border-gray-300 dark:border-gray-600 pb-1">
                    <span>Ville:</span>
                    <span className="font-semibold">{formState.city}</span>
                </div>}
                {formState.creditLimit && formState.isCreditLimited && <div className="flex justify-between text-xs pt-1 font-bold text-yellow-700 dark:text-yellow-400">
                    <span>Limite crédit:</span>
                    <span>${formState.creditLimit}</span>
                </div>}
            </div>
        );
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        
        try {
            // Validation de base
            if (!formState.name?.trim()) {
                throw new Error("Le nom du client est requis");
            }
            if (!formState.phone?.trim()) {
                throw new Error("Le numéro de téléphone est requis");
            }

            // Nettoyer les données
            const cleanData: any = {
                name: formState.name.trim(),
                phone: formState.phone.trim(),
                email: formState.email?.trim() || null,
                businessName: formState.businessName?.trim() || null,
                contactPerson: formState.contactPerson?.trim() || null,
                address: formState.address?.trim() || null,
                city: formState.city?.trim() || null,
                nif: formState.nif?.trim() || null,
                rccm: formState.rccm?.trim() || null,
                website: formState.website?.trim() || null,
                whatsapp: formState.whatsapp?.trim() || null,
                notes: formState.notes?.trim() || null,
                creditLimit: formState.creditLimit || 0,
                openingBalance: formState.openingBalance || 0,
                isCreditLimited: formState.isCreditLimited || false,
                openingBalanceDate: formState.openingBalanceDate || new Date().toISOString().split('T')[0]
            };

            // Tenter d'ajouter le champ whatsapp uniquement s'il est renseigné
            if (formState.whatsapp?.trim()) {
                cleanData.whatsapp = formState.whatsapp.trim();
            }

            // On n'inclut isArchived que s'il est explicitement défini dans l'objet formState
            // pour éviter d'écraser avec undefined si non présent
            if ('isArchived' in formState) {
                cleanData.isArchived = formState.isArchived;
            }

            if (isEditing) {
                if (!id) throw new Error("ID manquant");
                const { error: updateError } = await supabase
                    .from('customers')
                    .update(cleanData)
                    .eq('id', id);
                if (updateError) throw updateError;
                addToast('Client modifié avec succès', 'success', undefined, generateCustomerDetails());
            } else {
                const newId = crypto.randomUUID();
                const newCustomer = { ...cleanData, id: newId };
                const { error: insertError } = await supabase
                    .from('customers')
                    .insert(newCustomer);
                if (insertError) throw insertError;
                addToast('Client créé avec succès', 'success', undefined, generateCustomerDetails());
            }
            
            await refreshData(['customers']);

            if (returnTo) {
                // Pour le retour personnalisé (ex: depuis une vente), on garde la navigation immédiate
                // car le contexte est souvent préservé ou le toast moins critique ici
                // Mais pour la cohérence, on peut aussi mettre un délai si ce n'est pas un modal.
                setTimeout(() => navigate(returnTo), 500);
            } else {
                setTimeout(() => navigate('/customers'), 500);
            }
        } catch (err: any) {
            console.error("Erreur détaillée:", err);
            const errorMessage = err.message || 'Une erreur est survenue lors de l\'enregistrement';
            setError(`Erreur: ${errorMessage}`);
            addToast(errorMessage, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Chargement...</div>;

    const inputClasses = "mt-1 block w-full px-4 py-3 bg-white border border-gray-300 rounded-xl shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all font-medium";
    const labelClasses = "block text-xs font-black uppercase text-gray-400 tracking-widest mb-1";

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                    <button onClick={() => navigate(returnTo || '/customers')} className="p-2 mr-4 bg-white dark:bg-gray-800 rounded-full shadow-sm border dark:border-gray-700 hover:scale-110 transition-transform">
                        <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {isEditing ? "Modifier le Profil" : "Nouveau Client"}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Complétez les informations pour une gestion optimale.</p>
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
                {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold">{error}</div>}

                {/* Bloc 1 : Informations de base */}
                <section className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-primary-600 uppercase mb-6 flex items-center">
                        <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3 text-sm">1</span>
                        Identité Personnelle / Contact
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className={labelClasses}>Nom Complet *</label><input type="text" name="name" value={formState.name} onChange={handleInputChange} required className={inputClasses} /></div>
                        <div><label className={labelClasses}>Téléphone *</label><input type="tel" name="phone" value={formState.phone} onChange={handleInputChange} required className={inputClasses} /></div>
                        <div>
                            <label className={labelClasses}>WhatsApp</label>
                            <input 
                                type="tel" 
                                name="whatsapp" 
                                value={formState.whatsapp || ''} 
                                onChange={handleWhatsappChange} 
                                onBlur={handleWhatsappBlur}
                                placeholder="ex: 229XXXXXXXX" 
                                className={inputClasses} 
                            />
                            {formState.whatsapp && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Numéro international : <span className="font-mono font-semibold">+{normalizePhoneNumber(formState.whatsapp)}</span>
                                </p>
                            )}
                        </div>
                        <div><label className={labelClasses}>Adresse Email</label><input type="email" name="email" value={formState.email} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className={labelClasses}>Personne à contacter</label><input type="text" name="contactPerson" value={formState.contactPerson} onChange={handleInputChange} className={inputClasses} /></div>
                    </div>
                </section>

                {/* Bloc 2 : Informations Professionnelles */}
                <section className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-primary-600 uppercase mb-6 flex items-center">
                        <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3 text-sm">2</span>
                        Entreprise & Fiscalité
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2"><label className={labelClasses}>Nom de l'entreprise (Raison Sociale)</label><input type="text" name="businessName" value={formState.businessName} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className={labelClasses}>NIF (Identifiant Fiscal)</label><input type="text" name="nif" value={formState.nif} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className={labelClasses}>RCCM</label><input type="text" name="rccm" value={formState.rccm} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className={labelClasses}>Ville</label><input type="text" name="city" value={formState.city} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className={labelClasses}>Adresse Complète</label><input type="text" name="address" value={formState.address} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className={labelClasses}>Site Web</label><input type="url" name="website" value={formState.website} onChange={handleInputChange} placeholder="https://..." className={inputClasses} /></div>
                    </div>
                </section>

                {/* Bloc 3 : Gestion Financière */}
                <section className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-orange-600 uppercase mb-6 flex items-center">
                        <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3 text-sm">3</span>
                        Compte & Crédit
                    </h2>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed">
                             <div>
                                <label className={labelClasses}>Solde d'ouverture (FCFA)</label>
                                <input type="number" name="openingBalance" value={formState.openingBalance} onChange={handleInputChange} className={`${inputClasses} border-blue-200`} placeholder="Ancienne dette client..."/>
                                <p className="text-[10px] text-gray-500 mt-1 italic">Dette antérieure à l'utilisation du logiciel.</p>
                            </div>
                            <div>
                                <label className={labelClasses}>Date du solde</label>
                                <input type="date" name="openingBalanceDate" value={formState.openingBalanceDate} onChange={handleInputChange} className={inputClasses} />
                            </div>
                        </div>

                        <div className="flex items-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-800">
                            <input type="checkbox" name="isCreditLimited" id="isCreditLimited" checked={formState.isCreditLimited} onChange={handleInputChange} className="h-6 w-6 text-primary-600 rounded-lg border-gray-300 mr-4" />
                            <label htmlFor="isCreditLimited" className="text-sm font-bold text-orange-900 dark:text-orange-100 uppercase">Activer une limite de crédit pour ce client</label>
                        </div>
                        {formState.isCreditLimited && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                                <div><label className={labelClasses}>Plafond autorisé (FCFA)</label><input type="number" name="creditLimit" value={formState.creditLimit} onChange={handleInputChange} className={`${inputClasses} border-orange-300 font-black text-orange-600`} /></div>
                            </div>
                        )}
                        <div><label className={labelClasses}>Observations / Notes</label><textarea name="notes" value={formState.notes} onChange={handleInputChange} rows={3} className={inputClasses} placeholder="Ajoutez ici des détails spécifiques au client..."></textarea></div>
                    </div>
                </section>

                {/* Bloc 4 : Archivage (uniquement en édition) */}
                {isEditing && (
                    <section className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-black text-red-600 uppercase mb-6 flex items-center">
                            <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3 text-sm">4</span>
                            Archivage
                        </h2>
                        <div className="space-y-6">
                            <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800">
                                <input 
                                    type="checkbox" 
                                    name="isArchived" 
                                    id="isArchived" 
                                    checked={formState.isArchived || false} 
                                    onChange={handleInputChange} 
                                    className="h-6 w-6 text-red-600 rounded-lg border-gray-300 mr-4" 
                                />
                                <label htmlFor="isArchived" className="text-sm font-bold text-red-900 dark:text-red-100 uppercase">
                                    Archiver ce client (le rendre inactif)
                                </label>
                            </div>
                            {formState.isArchived && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100 dark:border-yellow-800">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-bold">
                                        ⚠️ Attention : L'archivage d'un client le rendra invisible dans la plupart des vues, 
                                        mais ses données historiques seront préservées.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                <div className="flex justify-end pt-6">
                    <button type="submit" disabled={isSaving} className="px-12 py-5 bg-primary-600 text-white rounded-2xl font-black shadow-2xl hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                        {isSaving ? "Sauvegarde..." : "Enregistrer le Profil"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CustomerFormPage;
