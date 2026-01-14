import React, { useState, useEffect, FormEvent } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, DocumentData, writeBatch } from 'firebase/firestore';
import { User, Role, Warehouse } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { useAuth } from '../hooks/useAuth';

const UsersPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<Partial<User>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [password, setPassword] = useState('');
    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white";

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [usersSnap, rolesSnap, warehousesSnap] = await Promise.all([
                getDocs(collection(db, "users")),
                getDocs(collection(db, "roles")),
                getDocs(collection(db, "warehouses")),
            ]);
            setUsers(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
            setRoles(rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
            setWarehouses(warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
        } catch (err) {
            setError("Impossible de charger les données.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openModalForNew = () => {
        setIsEditing(false);
        setCurrentUser({ roleId: roles[0]?.id, warehouseIds: [] });
        setPassword('');
        setError(null);
        setIsModalOpen(true);
    };

    const openModalForEdit = (user: User) => {
        setIsEditing(true);
        setCurrentUser(user);
        setPassword(''); // Don't pre-fill password for editing
        setError(null);
        setIsModalOpen(true);
    };
    
    const closeModal = () => setIsModalOpen(false);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentUser(prev => ({ ...prev, [name]: value }));
    };
    
    const handleWarehouseSelection = (warehouseId: string) => {
        const currentIds = currentUser.warehouseIds || [];
        const newIds = currentIds.includes(warehouseId)
            ? currentIds.filter(id => id !== warehouseId)
            : [...currentIds, warehouseId];
        setCurrentUser(prev => ({ ...prev, warehouseIds: newIds }));
    };

    const handleSaveUser = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        const userData: Partial<User> = { ...currentUser };
        if (password) {
            userData.password = password;
        }

        if (!userData.username || !userData.displayName || !userData.roleId) {
            setError("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        try {
            if (isEditing) {
                const { uid, ...dataToUpdate } = userData;
                await updateDoc(doc(db, 'users', uid!), dataToUpdate as DocumentData);
            } else {
                if (!password) {
                    setError("Le mot de passe est obligatoire pour un nouvel utilisateur.");
                    return;
                }
                await addDoc(collection(db, "users"), userData);
            }
            await fetchData();
            closeModal();
        } catch (err) {
            setError("Erreur lors de l'enregistrement de l'utilisateur.");
            console.error(err);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
            try {
                await deleteDoc(doc(db, "users", userId));
                await fetchData();
            } catch (err) {
                setError("Erreur lors de la suppression.");
            }
        }
    };
    
    const handleBulkDelete = async () => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            batch.delete(doc(db, "users", id));
        });
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
            setSelectedIds(users.map(u => u.uid));
        } else {
            setSelectedIds([]);
        }
    };

    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'N/A';
    const getWarehouseNames = (ids: string[] = []) => ids.map(id => warehouses.find(w => w.id === id)?.name).filter(Boolean).join(', ') || 'Aucun';

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Gestion des Utilisateurs</h1>
                {hasPermission('users') && (
                     <div className="flex items-center space-x-2">
                        {selectedIds.length > 0 && (
                            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                <DeleteIcon className="w-5 h-5 mr-2" />
                                Supprimer ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={openModalForNew} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
                            <PlusIcon className="w-5 h-5 mr-2" />
                            Ajouter un utilisateur
                        </button>
                    </div>
                )}
            </div>
            {loading ? <p>Chargement...</p> : error ? <p className="text-red-500">{error}</p> : (
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-primary-600"><tr>
                        <th className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/></th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Nom Complet</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Nom d'utilisateur</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Rôle</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Entrepôts</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-white uppercase">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map(user => (
                            <tr key={user.uid} className={selectedIds.includes(user.uid) ? 'bg-primary-50 dark:bg-gray-700/50' : ''}>
                                <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(user.uid)} onChange={() => handleSelectOne(user.uid)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/></td>
                                <td className="px-6 py-4">{user.displayName}</td>
                                <td className="px-6 py-4">{user.username}</td>
                                <td className="px-6 py-4">{getRoleName(user.roleId)}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{getWarehouseNames(user.warehouseIds)}</td>
                                <td className="px-6 py-4 text-right">
                                    {hasPermission('users') && (
                                        <DropdownMenu>
                                            <DropdownMenuItem onClick={() => openModalForEdit(user)}>
                                                <EditIcon className="w-4 h-4 mr-3" /> Modifier
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDeleteUser(user.uid)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
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
            )}
             <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Modifier l'Utilisateur" : "Ajouter un Utilisateur"}>
                <form onSubmit={handleSaveUser}>
                    <div className="p-6 space-y-4">
                        {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/40 p-2 rounded-md text-sm">{error}</p>}
                        <div><label className="text-sm">Nom complet</label><input type="text" name="displayName" value={currentUser.displayName || ''} onChange={handleFormChange} required className={inputClasses} /></div>
                        <div><label className="text-sm">Nom d'utilisateur</label><input type="text" name="username" value={currentUser.username || ''} onChange={handleFormChange} required className={inputClasses} /></div>
                        <div><label className="text-sm">{isEditing ? "Nouveau mot de passe" : "Mot de passe"}</label><input type="password" placeholder={isEditing ? "Laisser vide pour ne pas changer" : ""} value={password} onChange={e => setPassword(e.target.value)} className={inputClasses} /></div>
                        <div><label className="text-sm">Rôle</label><select name="roleId" value={currentUser.roleId || ''} onChange={handleFormChange} required className={inputClasses}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                        <div><label className="text-sm">Entrepôts Assignés</label><div className="grid grid-cols-2 gap-2 mt-2 border p-2 rounded max-h-40 overflow-y-auto dark:border-gray-600">{warehouses.map(wh => (
                            <div key={wh.id} className="text-sm"><label><input type="checkbox" checked={(currentUser.warehouseIds || []).includes(wh.id)} onChange={() => handleWarehouseSelection(wh.id)} className="mr-2"/> {wh.name}</label></div>
                        ))}</div></div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 sm:ml-3 sm:w-auto sm:text-sm">Sauvegarder</button>
                        <button type="button" onClick={closeModal} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-600 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 sm:mt-0 sm:w-auto sm:text-sm">Annuler</button>
                    </div>
                </form>
            </Modal>
            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmer la suppression">
                <div className="p-6"><p>Êtes-vous sûr de vouloir supprimer les {selectedIds.length} utilisateurs sélectionnés ?</p></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded">Supprimer</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="ml-2 px-4 py-2 bg-gray-200 rounded">Annuler</button>
                </div>
            </Modal>
        </div>
    );
};

export default UsersPage;
