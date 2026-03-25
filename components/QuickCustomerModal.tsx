import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Customer } from '../types';
import Modal from './Modal';

interface QuickCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (customer: Customer) => void;
}

const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Customer>>({
        name: '',
        phone: '',
        address: '',
        city: '',
        isCreditLimited: false,
        creditLimit: 0,
        openingBalance: 0
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!formData.name?.trim()) throw new Error("Le nom est requis.");
            if (!formData.phone?.trim()) throw new Error("Le téléphone est requis.");

            const newCustomer: Customer = {
                id: crypto.randomUUID(),
                name: formData.name.trim(),
                phone: formData.phone.trim(),
                address: formData.address?.trim() || undefined,
                city: formData.city?.trim() || undefined,
                isCreditLimited: formData.isCreditLimited!,
                creditLimit: formData.creditLimit ? Number(formData.creditLimit) : 0,
                openingBalance: formData.openingBalance ? Number(formData.openingBalance) : 0,
                isArchived: false,
                openingBalanceDate: new Date().toISOString().split('T')[0]
            };

            const { error: insertError } = await supabase
                .from('customers')
                .insert(newCustomer);

            if (insertError) throw insertError;

            onSuccess(newCustomer);
            onClose();
            // Reset form
            setFormData({
                name: '',
                phone: '',
                address: '',
                city: '',
                isCreditLimited: false,
                creditLimit: 0,
                openingBalance: 0
            });
        } catch (err: any) {
            console.error("Erreur création client:", err);
            setError(err.message || "Erreur lors de la création.");
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white";
    const labelClasses = "block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nouveau Client Rapide">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm font-bold">{error}</div>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className={labelClasses}>Nom Complet *</label>
                        <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className={inputClasses} autoFocus />
                    </div>
                    <div>
                        <label className={labelClasses}>Téléphone *</label>
                        <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} required className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>Ville</label>
                        <input type="text" name="city" value={formData.city || ''} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div className="col-span-2">
                        <label className={labelClasses}>Adresse</label>
                        <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className={inputClasses} />
                    </div>
                </div>

                <div className="border-t pt-4 dark:border-gray-700">
                    <div className="flex items-center mb-4">
                        <input 
                            type="checkbox" 
                            name="isCreditLimited" 
                            id="quick_isCreditLimited"
                            checked={formData.isCreditLimited || false} 
                            onChange={handleChange} 
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor="quick_isCreditLimited" className="ml-2 block text-sm font-bold text-gray-900 dark:text-gray-100">
                            Activer Limite de Crédit
                        </label>
                    </div>
                    
                    {formData.isCreditLimited && (
                        <div>
                            <label className={labelClasses}>Plafond (FCFA)</label>
                            <input type="number" name="creditLimit" value={formData.creditLimit || 0} onChange={handleChange} className={inputClasses} />
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-bold hover:bg-gray-200">Annuler</button>
                    <button type="submit" disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50">
                        {loading ? 'Création...' : 'Créer Client'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default QuickCustomerModal;
