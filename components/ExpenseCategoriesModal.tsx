import React, { useState } from 'react';
import { supabase } from '../supabase';
import { ExpenseCategory } from '../types';
import Modal from './Modal';
import { PlusIcon, TrashIcon, EditIcon, SaveIcon, XIcon } from '../constants';
import { useData } from '../context/DataContext';

interface ExpenseCategoriesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ExpenseCategoriesModal: React.FC<ExpenseCategoriesModalProps> = ({ isOpen, onClose }) => {
    const { expenseCategories, refreshData } = useData();
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        setIsLoading(true);
        setError(null);
        setSuccess(null);
        try {
            console.log('📝 Ajout de catégorie:', newCategoryName);
            const newId = `cat_${Date.now()}`;
            const newCategory = { 
                id: newId, 
                name: newCategoryName.trim() 
            };

            const { error: insertError } = await supabase
                .from('expense_categories')
                .insert(newCategory);

            if (insertError) throw insertError;
            
            console.log('✅ Catégorie ajoutée:', newCategory);
            setNewCategoryName('');
            setSuccess(`✅ Catégorie "${newCategoryName.trim()}" ajoutée avec succès!`);
            
            // Small delay to show success message before refresh
            setTimeout(async () => {
                await refreshData(['config']);
                setSuccess(null);
            }, 500);
        } catch (err: any) {
            console.error('❌ Erreur lors de l\'ajout:', err);
            const errorMessage = err.message || 'Erreur lors de l\'ajout de la catégorie';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory || !editingCategory.name.trim()) return;

        setIsLoading(true);
        setError(null);
        try {
            const { error: updateError } = await supabase
                .from('expense_categories')
                .update({ name: editingCategory.name.trim() })
                .eq('id', editingCategory.id);

            if (updateError) throw updateError;
            
            setEditingCategory(null);
            await refreshData(['config']);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;

        setIsLoading(true);
        setError(null);
        try {
            const { error: deleteError } = await supabase
                .from('expense_categories')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            await refreshData(['config']);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gérer les Catégories de Dépenses">
            <div className="p-6">
                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                {/* Add Form */}
                <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nouvelle catégorie..."
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !newCategoryName.trim()}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold disabled:opacity-50 transition-colors"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </form>

                {/* List */}
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {expenseCategories.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">Aucune catégorie définie.</p>
                    ) : (
                        expenseCategories.map(category => (
                            <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                {editingCategory?.id === category.id ? (
                                    <form onSubmit={handleUpdateCategory} className="flex-1 flex gap-2 mr-2">
                                        <input
                                            type="text"
                                            value={editingCategory.name}
                                            onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                            className="flex-1 px-2 py-1 border border-primary-500 rounded bg-white dark:bg-gray-800 dark:text-white outline-none"
                                            autoFocus
                                        />
                                        <button type="submit" className="text-green-600 hover:bg-green-100 p-1 rounded"><SaveIcon className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => setEditingCategory(null)} className="text-gray-500 hover:bg-gray-200 p-1 rounded"><XIcon className="w-4 h-4" /></button>
                                    </form>
                                ) : (
                                    <>
                                        <span className="font-medium text-gray-700 dark:text-gray-200">{category.name}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingCategory(category)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                title="Modifier"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(category.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                title="Supprimer"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>
    );
};
