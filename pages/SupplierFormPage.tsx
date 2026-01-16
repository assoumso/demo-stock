
import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, DocumentData } from 'firebase/firestore';
import { Supplier } from '../types';
import { ArrowLeftIcon } from '../constants';

const SupplierFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [formState, setFormState] = useState<Partial<Supplier>>({
        name: '',
        email: '',
        phone: '',
        businessName: '',
        address: '',
        city: '',
        nif: '',
        rccm: '',
        website: '',
        notes: ''
    });

    const [loading, setLoading] = useState(isEditing);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isEditing) {
            const fetchSupplier = async () => {
                try {
                    const docSnap = await getDoc(doc(db, 'suppliers', id));
                    if (docSnap.exists()) {
                        setFormState(docSnap.data() as Supplier);
                    } else {
                        setError("Fournisseur non trouvé.");
                    }
                } catch (err) {
                    setError("Erreur lors du chargement.");
                } finally {
                    setLoading(false);
                }
            };
            fetchSupplier();
        }
    }, [id, isEditing]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        try {
            if (isEditing) {
                await setDoc(doc(db, 'suppliers', id), formState as DocumentData, { merge: true });
            } else {
                await addDoc(collection(db, 'suppliers'), formState);
            }
            navigate('/suppliers');
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
                    <button onClick={() => navigate('/suppliers')} className="p-2 mr-4 bg-white dark:bg-gray-800 rounded-full shadow-sm border dark:border-gray-700 hover:scale-110 transition-transform">
                        <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {isEditing ? "Modifier le Fournisseur" : "Nouveau Fournisseur"}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Gérez vos relations d'approvisionnement avec précision.</p>
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
                {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold">{error}</div>}

                <section className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-primary-600 uppercase mb-6 flex items-center">
                        <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3 text-sm">1</span>
                        Contact & Identité
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className={labelClasses}>Nom de Contact *</label><input type="text" name="name" value={formState.name} onChange={handleInputChange} required className={inputClasses} /></div>
                        <div><label className={labelClasses}>Téléphone *</label><input type="tel" name="phone" value={formState.phone} onChange={handleInputChange} required className={inputClasses} /></div>
                        <div><label className={labelClasses}>Adresse Email</label><input type="email" name="email" value={formState.email} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className={labelClasses}>Site Web</label><input type="url" name="website" value={formState.website} onChange={handleInputChange} placeholder="https://..." className={inputClasses} /></div>
                    </div>
                </section>

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

                <section className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-primary-600 uppercase mb-6 flex items-center">
                        <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3 text-sm">3</span>
                        Solde d'Ouverture (Dette Initiale)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>Montant de la dette initiale</label>
                            <input type="number" name="openingBalance" value={formState.openingBalance || ''} onChange={handleInputChange} className={inputClasses} placeholder="0" />
                            <p className="text-xs text-gray-500 mt-1">Montant que vous devez à ce fournisseur avant l'utilisation du logiciel.</p>
                        </div>
                        <div>
                            <label className={labelClasses}>Date du solde</label>
                            <input type="date" name="openingBalanceDate" value={formState.openingBalanceDate || ''} onChange={handleInputChange} className={inputClasses} />
                        </div>
                    </div>
                </section>

                <section className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-primary-600 uppercase mb-6 flex items-center">
                        <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3 text-sm">4</span>
                        Compléments
                    </h2>
                    <div><label className={labelClasses}>Observations / Notes</label><textarea name="notes" value={formState.notes} onChange={handleInputChange} rows={3} className={inputClasses} placeholder="Historique des échanges, conditions de paiement habituelles..."></textarea></div>
                </section>

                <div className="flex justify-end pt-6">
                    <button type="submit" disabled={isSaving} className="px-12 py-5 bg-primary-600 text-white rounded-2xl font-black shadow-2xl hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                        {isSaving ? "Sauvegarde..." : "Enregistrer Fournisseur"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SupplierFormPage;
