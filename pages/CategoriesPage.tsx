import React, { useState, FormEvent } from 'react';
import { supabase } from '../supabase';
import { Category } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';

const CategoriesPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const { categories: items, loading, refreshData } = useData();
    const [error, setError] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<Category>>({});
    const [isEditing, setIsEditing] = useState(false);

    const openModalForNew = () => {
        setIsEditing(false);
        setCurrentItem({ name: '' });
        setIsModalOpen(true);
    };

    const openModalForEdit = (item: Category) => {
        setIsEditing(true);
        setCurrentItem(item);
        setIsModalOpen(true);
    };

    const closeModal = () => setIsModalOpen(false);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        const { id, ...data } = currentItem;
        if (!data.name) return;
        try {
            if (isEditing && id) {
                const { error } = await supabase.from('categories').update(data).eq('id', id);
                if (error) throw error;
            } else {
                const newId = crypto.randomUUID();
                const { error } = await supabase.from('categories').insert({ ...data, id: newId });
                if (error) throw error;
            }
            closeModal();
            await refreshData(['config']);
        } catch (err: any) {
            console.error(err);
            setError("Erreur d'enregistrement: " + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Supprimer cette catégorie ?")) {
            try {
                const { error } = await supabase.from('categories').delete().eq('id', id);
                if (error) throw error;
                await refreshData(['config']);
            } catch (err: any) {
                console.error(err);
                setError("Erreur de suppression: " + err.message);
            }
        }
    };

    const handleBulkDelete = async () => {
        try {
            const { error } = await supabase.from('categories').delete().in('id', selectedIds);
            if (error) throw error;
            setIsBulkDeleteModalOpen(false);
            setSelectedIds([]);
            await refreshData(['config']);
        } catch (err: any) {
            console.error(err);
            setError("Erreur lors de la suppression en masse: " + err.message);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(items.map(i => i.id));
        } else {
            setSelectedIds([]);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold">Gestion des Catégories</h1>
                {hasPermission('categories') && (
                    <div className="flex items-center space-x-2">
                        {selectedIds.length > 0 && (
                            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                <DeleteIcon className="w-5 h-5 mr-2" />
                                Supprimer ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={openModalForNew} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"><PlusIcon className="w-5 h-5 mr-2" />Ajouter une catégorie</button>
                    </div>
                )}
            </div>
            {loading ? <p>Chargement...</p> : (
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-primary-600"><tr>
                        <th className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/></th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Nom</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-white uppercase">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {items.map(item => (<tr key={item.id} className={selectedIds.includes(item.id) ? 'bg-primary-50 dark:bg-gray-700/50' : ''}>
                        <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => handleSelectOne(item.id)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/></td>
                        <td className="px-6 py-4">{item.name}</td><td className="px-6 py-4 text-right">
                            {hasPermission('categories') && (
                                <DropdownMenu>
                                    <DropdownMenuItem onClick={() => openModalForEdit(item)}>
                                        <EditIcon className="w-4 h-4 mr-3" /> Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                                        <DeleteIcon className="w-4 h-4 mr-3" /> Supprimer
                                    </DropdownMenuItem>
                                </DropdownMenu>
                            )}
                        </td></tr>))}
                    </tbody>
                </table>
            </div>
            )}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Modifier la catégorie" : "Ajouter une catégorie"}>
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <input type="text" placeholder="Nom de la catégorie" value={currentItem.name || ''} onChange={e => setCurrentItem({ ...currentItem, name: e.target.value })} className="w-full border rounded p-2 dark:bg-gray-700"/>
                    <div className="flex justify-end space-x-2"><button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-md">Annuler</button><button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded">Sauvegarder</button></div>
                </form>
            </Modal>
            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmer la suppression">
                <div className="p-6"><p>Êtes-vous sûr de vouloir supprimer les {selectedIds.length} catégories sélectionnées ?</p></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded">Supprimer</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="ml-2 px-4 py-2 bg-gray-200 rounded">Annuler</button>
                </div>
            </Modal>
        </div>
    );
};
export default CategoriesPage;
