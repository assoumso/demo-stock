
import React, { useState, useEffect, FormEvent } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, DocumentData, writeBatch } from 'firebase/firestore';
import { Warehouse } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon, ShieldCheckIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { useAuth } from '../hooks/useAuth';

const COLOR_OPTIONS = [
    { name: 'Bleu', value: 'blue', class: 'bg-blue-500' },
    { name: 'Vert', value: 'emerald', class: 'bg-emerald-500' },
    { name: 'Violet', value: 'purple', class: 'bg-purple-500' },
    { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
    { name: 'Jaune', value: 'yellow', class: 'bg-yellow-500' },
    { name: 'Rouge', value: 'red', class: 'bg-red-500' },
    { name: 'Cyan', value: 'cyan', class: 'bg-cyan-500' },
    { name: 'Indigo', value: 'indigo', class: 'bg-indigo-500' },
    { name: 'Rose', value: 'rose', class: 'bg-rose-500' },
];

const WarehousesPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentWarehouse, setCurrentWarehouse] = useState<Partial<Warehouse>>({});
    const [isEditing, setIsEditing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const warehousesSnap = await getDocs(collection(db, "warehouses"));
            setWarehouses(warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
        } catch (err) {
            setError("Impossible de charger les entrepôts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openModalForNew = () => {
        setIsEditing(false);
        setCurrentWarehouse({ name: '', location: '', isMain: false, color: 'blue' });
        setIsModalOpen(true);
    };

    const openModalForEdit = (warehouse: Warehouse) => {
        setIsEditing(true);
        setCurrentWarehouse(warehouse);
        setIsModalOpen(true);
    };
    
    const closeModal = () => setIsModalOpen(false);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        const { id, ...data } = currentWarehouse;
        if (!data.name) {
            setError("Le nom est requis.");
            return;
        }

        try {
            if (isEditing) {
                await updateDoc(doc(db, 'warehouses', id!), data as DocumentData);
            } else {
                await addDoc(collection(db, "warehouses"), data);
            }
            await fetchData();
            closeModal();
        } catch (err) {
            setError("Erreur d'enregistrement.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Supprimer cet entrepôt ?")) {
            try {
                await deleteDoc(doc(db, "warehouses", id));
                await fetchData();
            } catch (err) {
                setError("Erreur de suppression.");
            }
        }
    };

    const handleBulkDelete = async () => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => batch.delete(doc(db, 'warehouses', id)));
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
            setSelectedIds(warehouses.map(w => w.id));
        } else {
            setSelectedIds([]);
        }
    };

    const getBgClass = (colorName: string = 'blue') => {
        const option = COLOR_OPTIONS.find(c => c.value === colorName);
        return option ? option.class : 'bg-blue-500';
    };

    return (
        <div className="pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Gestion des Entrepôts</h1>
                    <p className="text-gray-500 text-sm">Définissez vos lieux de stockage et leurs identités visuelles.</p>
                </div>
                {hasPermission('warehouses') && (
                    <div className="flex items-center space-x-2">
                        {selectedIds.length > 0 && (
                            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold uppercase text-xs transition-all shadow-lg active:scale-95">
                                <DeleteIcon className="w-5 h-5 mr-2" />
                                Supprimer ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={openModalForNew} className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black uppercase text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95">
                            <PlusIcon className="w-5 h-5 mr-2" />
                            Ajouter un entrepôt
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="p-24 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">Chargement de la logistique...</div>
            ) : error ? (
                <p className="text-red-500 font-bold text-center p-8 bg-red-50 rounded-2xl">{error}</p>
            ) : (
            <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-primary-600">
                            <tr>
                                <th className="px-4 py-4 w-10 text-center">
                                    <input type="checkbox" onChange={handleSelectAll} className="h-4 w-4 text-primary-900 border-white rounded focus:ring-0 cursor-pointer"/>
                                </th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Identité / Couleur</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Emplacement</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">Statut</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {warehouses.map(w => (
                                <tr key={w.id} className={selectedIds.includes(w.id) ? 'bg-primary-50 dark:bg-primary-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors'}>
                                    <td className="px-4 py-4 text-center">
                                        <input type="checkbox" checked={selectedIds.includes(w.id)} onChange={() => handleSelectOne(w.id)} className="h-4 w-4 text-primary-600 rounded cursor-pointer"/>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`w-3 h-10 rounded-full mr-4 ${getBgClass(w.color)} shadow-sm`}></div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{w.name}</div>
                                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Palette: {w.color || 'Défaut'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 font-medium">{w.location}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {w.isMain ? (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full tracking-widest border border-green-200">Principal</span>
                                        ) : (
                                            <span className="px-3 py-1 bg-gray-100 text-gray-400 text-[10px] font-black uppercase rounded-full tracking-widest">Secondaire</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {hasPermission('warehouses') && (
                                            <DropdownMenu>
                                                <DropdownMenuItem onClick={() => openModalForEdit(w)}>
                                                    <EditIcon className="w-4 h-4 mr-3" /> Modifier
                                                </DropdownMenuItem>
                                                <div className="border-t dark:border-gray-700 my-1"></div>
                                                <DropdownMenuItem onClick={() => handleDelete(w.id)} className="text-red-600 font-bold">
                                                    <DeleteIcon className="w-4 h-4 mr-3" /> Supprimer
                                                </DropdownMenuItem>
                                            </DropdownMenu>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Configuration de l'entrepôt" : "Nouvel entrepôt"} maxWidth="max-w-xl">
                <form onSubmit={handleSave} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1">Nom du site</label>
                            <input type="text" placeholder="Ex: Entrepôt Nord" value={currentWarehouse.name || ''} onChange={e => setCurrentWarehouse({...currentWarehouse, name: e.target.value})} className="w-full border-2 rounded-xl p-3 dark:bg-gray-700 dark:border-gray-600 outline-none focus:border-primary-500 transition-all font-bold uppercase"/>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1">Emplacement géographique</label>
                            <input type="text" placeholder="Adresse complète..." value={currentWarehouse.location || ''} onChange={e => setCurrentWarehouse({...currentWarehouse, location: e.target.value})} className="w-full border-2 rounded-xl p-3 dark:bg-gray-700 dark:border-gray-600 outline-none focus:border-primary-500 transition-all font-medium"/>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-3">Palette de couleur (Identité visuelle)</label>
                            <div className="grid grid-cols-4 gap-3">
                                {COLOR_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setCurrentWarehouse({ ...currentWarehouse, color: opt.value })}
                                        className={`relative h-12 rounded-xl border-2 transition-all flex items-center justify-center ${
                                            currentWarehouse.color === opt.value 
                                            ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-primary-500' 
                                            : 'border-transparent hover:scale-105'
                                        } ${opt.class}`}
                                        title={opt.name}
                                    >
                                        {currentWarehouse.color === opt.value && <ShieldCheckIcon className="w-5 h-5 text-white shadow-md" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
                            <input type="checkbox" id="isMain" checked={currentWarehouse.isMain || false} onChange={e => setCurrentWarehouse({...currentWarehouse, isMain: e.target.checked})} className="w-6 h-6 text-primary-600 rounded-lg mr-3 cursor-pointer" />
                            <label htmlFor="isMain" className="text-xs font-black uppercase text-gray-600 dark:text-gray-300 cursor-pointer">Définir comme entrepôt principal de l'entreprise</label>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={closeModal} className="px-6 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest">Annuler</button>
                        <button type="submit" className="px-10 py-3 bg-primary-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-primary-700 active:scale-95 transition-all">Enregistrer le site</button>
                    </div>
                </form>
            </Modal>

             <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmation de suppression">
                <div className="p-6"><p className="text-sm font-bold text-gray-600">Supprimer définitivement les {selectedIds.length} entrepôts sélectionnés ?</p></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleBulkDelete} className="bg-red-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-red-700 ml-3">Confirmer</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="px-6 py-2 bg-white text-gray-700 border rounded-xl font-black text-xs uppercase tracking-widest">Annuler</button>
                </div>
            </Modal>
        </div>
    );
};

export default WarehousesPage;
