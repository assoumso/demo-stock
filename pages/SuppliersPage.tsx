
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Supplier } from '../types';
import { PlusIcon, EditIcon, DeleteIcon, EyeIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';

const SuppliersPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const suppliersSnap = await getDocs(collection(db, "suppliers"));
            setSuppliers(suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
        } catch (err) {
            setError("Impossible de charger les fournisseurs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm("Supprimer ce fournisseur ?")) {
            try { await deleteDoc(doc(db, "suppliers", id)); await fetchData(); } 
            catch (err) { setError("Erreur de suppression."); }
        }
    };

    const handleBulkDelete = async () => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => batch.delete(doc(db, 'suppliers', id)));
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
            setSelectedIds(suppliers.map(s => s.id));
        } else {
            setSelectedIds([]);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Gestion des Fournisseurs</h1>
                {hasPermission('suppliers') && (
                    <div className="flex items-center space-x-2">
                        {selectedIds.length > 0 && (
                            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                <DeleteIcon className="w-5 h-5 mr-2" />
                                Supprimer ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={() => navigate('/suppliers/new')} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-bold uppercase text-sm"><PlusIcon className="w-5 h-5 mr-2" />Nouveau fournisseur</button>
                    </div>
                )}
            </div>
            {error && <p className="mb-4 text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
            {loading ? <p>Chargement...</p> : (
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto rounded-2xl">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-primary-600"><tr>
                            <th className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/></th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Identité / Entreprise</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Contact</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">RCCM / NIF</th>
                            <th className="px-6 py-3 text-right text-[10px] font-black text-white uppercase tracking-widest">Actions</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {suppliers.map(item => (<tr key={item.id} className={selectedIds.includes(item.id) ? 'bg-primary-50 dark:bg-gray-700/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors'}>
                            <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => handleSelectOne(item.id)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/></td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase">{item.name}</div>
                                {item.businessName && <div className="text-[10px] font-black text-gray-400 uppercase">{item.businessName}</div>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-medium">
                                <div>{item.phone}</div>
                                <div className="text-[10px] font-bold text-primary-600">{item.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-bold">
                                <div className="uppercase">{item.rccm || '-'}</div>
                                <div className="text-[10px] uppercase">{item.nif || '-'}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                {hasPermission('suppliers') && (
                                    <DropdownMenu>
                                        <DropdownMenuItem onClick={() => navigate(`/suppliers/account/${item.id}`)}>
                                            <EyeIcon className="w-4 h-4 mr-3 text-blue-500"/> Compte Fournisseur
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => navigate(`/suppliers/edit/${item.id}`)}>
                                            <EditIcon className="w-4 h-4 mr-3"/> Modifier Profil
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600 font-bold">
                                            <DeleteIcon className="w-4 h-4 mr-3"/> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenu>
                                )}
                            </td></tr>))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
             <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmer la suppression">
                <div className="p-6"><p>Êtes-vous sûr de vouloir supprimer les {selectedIds.length} fournisseurs sélectionnés ?</p></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded">Supprimer</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="ml-2 px-4 py-2 bg-gray-200 rounded">Annuler</button>
                </div>
            </Modal>
        </div>
    );
};

export default SuppliersPage;
