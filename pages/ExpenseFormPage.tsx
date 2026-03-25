import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabase';
import { Expense } from '../types';
import { SaveIcon, ArrowLeftIcon } from '../constants';

const ExpenseFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    const navigate = useNavigate();
    const { user } = useAuth();
    const { expenseCategories, refreshData } = useData();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditMode);

    const [formData, setFormData] = useState<Partial<Expense>>({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        categoryId: '',
        description: '',
        paymentMethod: 'Espèces',
        reference: '',
        paidTo: '',
    });

    useEffect(() => {
        if (id) {
            setFetching(true);
            const fetchExpense = async () => {
                try {
                    const { data, error } = await supabase
                        .from('expenses')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (data && !error) {
                        setFormData(data as Expense);
                    } else {
                        console.error('Dépense introuvable');
                        navigate('/expenses');
                    }
                } catch (error) {
                    console.error('Erreur chargement dépense:', error);
                    navigate('/expenses');
                } finally {
                    setFetching(false);
                }
            };
            fetchExpense();
        }
    }, [id, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'amount' ? (parseFloat(value) || 0) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.amount || formData.amount <= 0) {
                alert('Le montant doit être supérieur à 0');
                setLoading(false);
                return;
            }
            // Temporairement désactivé pour faciliter la création si pas de catégories
            // if (!formData.categoryId) {
            //     alert('Veuillez sélectionner une catégorie');
            //     setLoading(false);
            //     return;
            // }

            const now = new Date();
            const expenseData: any = {
                ...formData,
                createdByUserId: user?.uid || 'unknown',
                date: (formData.date || new Date().toISOString().split('T')[0]).includes('T') 
                    ? (formData.date || new Date().toISOString()) 
                    : `${formData.date || new Date().toISOString().split('T')[0]}T${now.toISOString().split('T')[1]}`,
                categoryId: formData.categoryId || 'uncategorized'
            };

            if (id) {
                const { error: updateError } = await supabase
                    .from('expenses')
                    .update(expenseData)
                    .eq('id', id);
                if (updateError) throw updateError;
            } else {
                const newId = crypto.randomUUID();
                const { error: insertError } = await supabase
                    .from('expenses')
                    .insert({ ...expenseData, id: newId });
                if (insertError) throw insertError;
            }

            await refreshData(['expenses']);
            navigate('/expenses');
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('Une erreur est survenue lors de la sauvegarde');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="flex h-screen items-center justify-center">Chargement...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => navigate('/expenses')}
                        className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5 mr-2" />
                        Retour aux dépenses
                    </button>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        {id ? 'Modifier la dépense' : 'Nouvelle Dépense'}
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Date</label>
                            <input
                                type="date"
                                name="date"
                                required
                                value={formData.date ? formData.date.split('T')[0] : ''}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Montant</label>
                            <input
                                type="number"
                                name="amount"
                                required
                                min="0"
                                step="0.01"
                                value={formData.amount}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all font-mono text-lg font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Catégorie</label>
                            <select
                                name="categoryId"
                                // required // Désactivé temporairement
                                value={formData.categoryId || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all appearance-none"
                            >
                                <option value="">Sélectionner une catégorie</option>
                                {expenseCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Mode de Paiement</label>
                            <select
                                name="paymentMethod"
                                required
                                value={formData.paymentMethod}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all appearance-none"
                            >
                                <option value="Espèces">Espèces</option>
                                <option value="Mobile Money">Mobile Money</option>
                                <option value="Virement bancaire">Virement bancaire</option>
                                <option value="Autre">Autre</option>
                            </select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Description</label>
                            <textarea
                                name="description"
                                required
                                rows={3}
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Détails de la dépense..."
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Bénéficiaire (Optionnel)</label>
                            <input
                                type="text"
                                name="paidTo"
                                value={formData.paidTo || ''}
                                onChange={handleChange}
                                placeholder="Payé à..."
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Référence (Optionnel)</label>
                            <input
                                type="text"
                                name="reference"
                                value={formData.reference || ''}
                                onChange={handleChange}
                                placeholder="N° Facture / Reçu..."
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={() => navigate('/expenses')}
                            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-xl font-bold transition-all"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex items-center justify-center px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-red-500/30 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            <SaveIcon className="w-5 h-5 mr-2" />
                            {loading ? 'Enregistrement...' : 'Enregistrer la dépense'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExpenseFormPage;
