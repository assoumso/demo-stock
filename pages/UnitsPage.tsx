import React, { useState, useEffect, FormEvent } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, DocumentData, writeBatch } from 'firebase/firestore';
import { Unit } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { useAuth } from '../hooks/useAuth';

const UnitsPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const [items, setItems] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<Unit>>({});
    const [isEditing, setIsEditing] = useState(false);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);


    const fetchData = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "units"));
            setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
        } catch (err) {
            setError("Impossible de charger les unités.");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchData(); }, []);

    const openModalForNew = () => { setIsEditing(false); setCurrentItem({ name: '' }); setIsModalOpen(true); };
    const openModalForEdit = (item: Unit) => { setIsEditing(true); setCurrentItem(item); setIsModalOpen(true); };
    const closeModal = () => setIsModalOpen(false);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        const { id, ...data } = currentItem;
        if (!data.name) return;
        try {
            if (isEditing) { await updateDoc(doc(db, 'units', id!), data as DocumentData); } 
            else { await addDoc(collection(db, "units"), data); }
            await fetchData();
            closeModal();
        } catch (err) { setError("Erreur d'enregistrement."); }
    };
    const handleDelete = async (id: string) => {
        if (window.confirm("Supprimer cette unité ?")) {
            try { await deleteDoc(doc(db, "units", id)); await fetchData(); } 
            catch (err) { setError("Erreur de suppression."); }
        }
    };
    
    const handleBulkDelete = async () => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => batch.delete(doc(db, 'units', id)));
        await batch.commit();
        await fetchData();
        setSelectedIds([]);
        setIsBulkDeleteModalOpen(false);
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
                <h1 className="text-2xl font-semibold">Gestion des Unités</h1>
                {hasPermission('units') && (
                    <div className="flex items-center space-x-2">
                        {selectedIds.length > 0 && (
                            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                <DeleteIcon className="w-5 h-5 mr-2" />
                                Supprimer ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={openModalForNew} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"><PlusIcon className="w-5 h-5 mr-2" />Ajouter une unité</button>
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
                            {hasPermission('units') && (
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
            <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Modifier l'unité" : "Ajouter une unité"}>
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <input type="text" placeholder="Nom de l'unité" value={currentItem.name || ''} onChange={e => setCurrentItem({ ...currentItem, name: e.target.value })} className="w-full border rounded p-2 dark:bg-gray-700"/>
                    <div className="flex justify-end space-x-2"><button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-md">Annuler</button><button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded">Sauvegarder</button></div>
                </form>
            </Modal>
            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmer la suppression">
                <div className="p-6"><p>Êtes-vous sûr de vouloir supprimer les {selectedIds.length} unités sélectionnées ?</p></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded">Supprimer</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="ml-2 px-4 py-2 bg-gray-200 rounded">Annuler</button>
                </div>
            </Modal>
        </div>
    );
};
export default UnitsPage;
