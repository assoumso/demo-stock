import React, { useState, useEffect, FormEvent } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, DocumentData, writeBatch } from 'firebase/firestore';
import { Role, Warehouse } from '../types';
import { permissionConfig } from '../config/permissions';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';

const RolesPage: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRole, setCurrentRole] = useState<Partial<Role>>({});
    const [isEditing, setIsEditing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rolesSnap, warehousesSnap] = await Promise.all([
                getDocs(collection(db, "roles")),
                getDocs(collection(db, "warehouses")),
            ]);
            setRoles(rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
            setWarehouses(warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
        } catch (err) {
            setError("Impossible de charger les rôles.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openModalForNew = () => {
        setIsEditing(false);
        setCurrentRole({ name: '', permissions: [], warehouseIds: [] });
        setIsModalOpen(true);
    };

    const openModalForEdit = (role: Role) => {
        setIsEditing(true);
        setCurrentRole(role);
        setIsModalOpen(true);
    };

    const closeModal = () => setIsModalOpen(false);

    const handlePermissionChange = (permission: string, isChecked: boolean) => {
        const currentPermissions = currentRole.permissions || [];
        const newPermissions = isChecked
            ? [...currentPermissions, permission]
            : currentPermissions.filter(p => p !== permission);
        setCurrentRole(prev => ({ ...prev, permissions: newPermissions }));
    };

    const handleWarehouseChange = (warehouseId: string, isChecked: boolean) => {
        const currentIds = currentRole.warehouseIds || [];
        const newIds = isChecked
            ? [...currentIds, warehouseId]
            : currentIds.filter(id => id !== warehouseId);
        setCurrentRole(prev => ({ ...prev, warehouseIds: newIds }));
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        const { id, ...data } = currentRole;
        if (!data.name) {
            setError("Le nom est requis.");
            return;
        }

        try {
            if (isEditing) {
                await updateDoc(doc(db, 'roles', id!), data as DocumentData);
            } else {
                await addDoc(collection(db, "roles"), data);
            }
            await fetchData();
            closeModal();
        } catch (err) {
            setError("Erreur d'enregistrement.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Supprimer ce rôle ?")) {
            try {
                await deleteDoc(doc(db, "roles", id));
                await fetchData();
            } catch (err) {
                setError("Erreur de suppression.");
            }
        }
    };

    const handleBulkDelete = async () => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => batch.delete(doc(db, 'roles', id)));
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
            setSelectedIds(roles.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };
    
    const getPermissionName = (permissionId: string) => {
        for (const group of permissionConfig) {
            const perm = group.permissions.find(p => p.id === permissionId);
            if (perm) return perm.name;
        }
        return permissionId;
    };
    
    const getWarehouseName = (warehouseId: string) => {
        return warehouses.find(w => w.id === warehouseId)?.name || 'Inconnu';
    };


    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold">Rôles & Permissions</h1>
                <div className="flex items-center space-x-2">
                    {selectedIds.length > 0 && (
                        <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                            <DeleteIcon className="w-5 h-5 mr-2" />
                            Supprimer ({selectedIds.length})
                        </button>
                    )}
                    <button onClick={openModalForNew} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md"><PlusIcon className="w-5 h-5 mr-2" />Ajouter un Rôle</button>
                </div>
            </div>
             <div className="mb-4">
                <label className="inline-flex items-center">
                    <input type="checkbox" onChange={handleSelectAll} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <span className="ml-2 text-sm">Tout sélectionner</span>
                </label>
            </div>
            {loading ? <p>Chargement...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map(role => (
                    <div key={role.id} className={`relative bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md ${selectedIds.includes(role.id) ? 'ring-2 ring-primary-500' : ''}`}>
                        <div className="absolute top-3 right-3 z-10">
                             <input type="checkbox" checked={selectedIds.includes(role.id)} onChange={() => handleSelectOne(role.id)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/>
                        </div>
                        <div className="flex justify-between items-start">
                            <h2 className="text-xl font-bold pr-10">{role.name}</h2>
                            <DropdownMenu>
                                <DropdownMenuItem onClick={() => openModalForEdit(role)}>
                                    <EditIcon className="w-4 h-4 mr-3" /> Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(role.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                                    <DeleteIcon className="w-4 h-4 mr-3" /> Supprimer
                                </DropdownMenuItem>
                            </DropdownMenu>
                        </div>
                        <h3 className="font-semibold text-base mt-4 border-t pt-3 dark:border-gray-700">Permissions</h3>
                        <ul className="mt-2 space-y-1 text-sm max-h-32 overflow-y-auto">
                            {role.permissions.sort().map(p => <li key={p} className="text-gray-600 dark:text-gray-300">&#10003; {getPermissionName(p)}</li>)}
                        </ul>
                        <h3 className="font-semibold text-base mt-4 border-t pt-3 dark:border-gray-700">Entrepôts Autorisés (Ventes)</h3>
                        <ul className="mt-2 space-y-1 text-sm max-h-24 overflow-y-auto">
                            {(role.warehouseIds && role.warehouseIds.length > 0)
                                ? role.warehouseIds.map(whId => <li key={whId} className="text-gray-600 dark:text-gray-300">&#10003; {getWarehouseName(whId)}</li>)
                                : <li className="text-gray-500 italic">Tous (non restreint par le rôle)</li>
                            }
                        </ul>
                    </div>
                ))}
            </div>
            )}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? 'Modifier le Rôle' : 'Nouveau Rôle'} maxWidth="max-w-3xl">
                <form onSubmit={handleSave}>
                    <div className="p-6 space-y-4">
                        <input type="text" placeholder="Nom du rôle" value={currentRole.name || ''} onChange={e => setCurrentRole({...currentRole, name: e.target.value})} className="w-full border rounded p-2 dark:bg-gray-700"/>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto border rounded p-4 dark:border-gray-600">
                            {permissionConfig.map(group => (
                                <div key={group.group}>
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 border-b dark:border-gray-600 pb-2 mb-2">{group.group}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {group.permissions.map(perm => (
                                            <label key={perm.id} className="flex items-center space-x-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                                <input 
                                                    type="checkbox" 
                                                    checked={(currentRole.permissions || []).includes(perm.id)} 
                                                    onChange={(e) => handlePermissionChange(perm.id, e.target.checked)} 
                                                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{perm.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 border-b dark:border-gray-600 pb-2 mb-2 mt-4">Entrepôts Autorisés pour la Vente</h3>
                                <p className="text-xs text-gray-500 mb-2">Définissez les entrepôts dans lesquels les utilisateurs avec ce rôle sont autorisés à effectuer des ventes. Si aucun n'est coché, l'accès n'est pas restreint par le rôle (mais peut l'être au niveau de l'utilisateur).</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {warehouses.map(wh => (
                                        <label key={wh.id} className="flex items-center space-x-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                            <input 
                                                type="checkbox" 
                                                checked={(currentRole.warehouseIds || []).includes(wh.id)} 
                                                onChange={(e) => handleWarehouseChange(wh.id, e.target.checked)} 
                                                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{wh.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 sm:ml-3 sm:w-auto sm:text-sm">Sauvegarder</button>
                        <button type="button" onClick={closeModal} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-600 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 sm:mt-0 sm:w-auto sm:text-sm">Annuler</button>
                    </div>
                </form>
            </Modal>
             <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmer la suppression">
                <div className="p-6"><p>Êtes-vous sûr de vouloir supprimer les {selectedIds.length} rôles sélectionnés ?</p></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded">Supprimer</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="ml-2 px-4 py-2 bg-gray-200 rounded">Annuler</button>
                </div>
            </Modal>
        </div>
    );
};

export default RolesPage;