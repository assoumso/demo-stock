
import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, DocumentData } from 'firebase/firestore';
import { Customer } from '../types';
import { ArrowLeftIcon, ShieldCheckIcon } from '../constants';

const CustomerFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [formState, setFormState] = useState<Partial<Customer>>({
        name: '',
        email: '',
        phone: '',
        businessName: '',
        address: '',
        city: '',
        nif: '',
        rccm: '',
        website: '',
        notes: '',
        isCreditLimited: false,
        creditLimit: 0
    });

    const [loading, setLoading] = useState(isEditing);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isEditing) {
            const fetchCustomer = async () => {
                try {
                    const docSnap = await getDoc(doc(db, 'customers', id));
                    if (docSnap.exists()) {
                        setFormState(docSnap.data() as Customer);
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
            const isNumber = ['creditLimit'].includes(name);
            setFormState(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        try {
            if (isEditing) {
                await setDoc(doc(db, 'customers', id), formState as DocumentData, { merge: true });
            } else {
                await addDoc(collection(db, 'customers'), formState);
            }
            navigate('/customers');
        } catch (err: any) {
            setError(`Erreur: ${err.message}`);
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
                    <button onClick={() => navigate('/customers')} className="p-2 mr-4 bg-white dark:bg-gray-800 rounded-full shadow-sm border dark:border-gray-700 hover:scale-110 transition-transform">
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
                        <div><label className={labelClasses}>Adresse Email</label><input type="email" name="email" value={formState.email} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className={labelClasses}>Site Web</label><input type="url" name="website" value={formState.website} onChange={handleInputChange} placeholder="https://..." className={inputClasses} /></div>
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
                    </div>
                </section>

                {/* Bloc 3 : Gestion Financière */}
                <section className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-orange-600 uppercase mb-6 flex items-center">
                        <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3 text-sm">3</span>
                        Compte & Crédit
                    </h2>
                    <div className="space-y-6">
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
