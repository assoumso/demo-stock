
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, query, orderBy, onSnapshot, deleteDoc, writeBatch } from 'firebase/firestore';
import { Quote } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PlusIcon, EditIcon, DeleteIcon, DocumentTextIcon, PrintIcon, CheckIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { formatCurrency } from '../utils/formatters';
import { useReactToPrint } from 'react-to-print';

const QuotesPage: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const { customers } = useData();
    const navigate = useNavigate();

    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, "quotes"), orderBy("date", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote)));
            setLoading(false);
        }, (err) => {
            setError("Erreur de synchronisation des devis.");
            setLoading(false);
            console.error(err);
        });

        return () => unsubscribe();
    }, []);

    const filteredQuotes = useMemo(() => {
        return quotes.filter(quote => {
            const customerName = customers.find(c => c.id === quote.customerId)?.name || '';
            const searchLower = searchTerm.toLowerCase();
            return (
                quote.referenceNumber.toLowerCase().includes(searchLower) ||
                customerName.toLowerCase().includes(searchLower)
            );
        });
    }, [quotes, customers, searchTerm]);

    const paginatedQuotes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredQuotes.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredQuotes, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage);

    const handleDeleteQuote = async () => {
        if (!quoteToDelete) return;
        try {
            await deleteDoc(doc(db, "quotes", quoteToDelete.id));
            setIsDeleteModalOpen(false);
            setQuoteToDelete(null);
        } catch (err) {
            setError("Erreur lors de la suppression du devis.");
        }
    };

    const handleBulkDelete = async () => {
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => batch.delete(doc(db, "quotes", id)));
            await batch.commit();
            setSelectedIds([]);
            setIsBulkDeleteModalOpen(false);
        } catch (err) {
            setError("Erreur lors de la suppression groupée.");
        }
    };

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Client inconnu';

    const getStatusLabel = (quote: Quote) => {
        if (quote.status === 'Converti') {
            if (quote.convertedSaleId) return 'Converti en Vente';
            if (quote.convertedPurchaseId) return 'Converti en Achat';
        }
        return quote.status;
    };

    const getStatusColor = (quote: Quote) => {
        switch (quote.status) {
            case 'Brouillon': return 'bg-gray-100 text-gray-800';
            case 'Envoyé': return 'bg-blue-100 text-blue-800';
            case 'Accepté': return 'bg-green-100 text-green-800';
            case 'Refusé': return 'bg-red-100 text-red-800';
            case 'Converti': 
                if (quote.convertedPurchaseId) return 'bg-blue-100 text-blue-800';
                return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Devis</h1>
                    <p className="text-gray-500 text-sm">Gérez vos devis clients.</p>
                </div>
                <div className="flex items-center space-x-2">
                    {hasPermission('sales:delete') && selectedIds.length > 0 && (
                        <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold uppercase text-xs shadow-lg transition-all">
                            <DeleteIcon className="w-5 h-5 mr-2" /> Supprimer ({selectedIds.length})
                        </button>
                    )}
                    {hasPermission('sales:create') && (
                        <button onClick={() => navigate('/quotes/new')} className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black uppercase text-xs shadow-xl transition-all">
                            <PlusIcon className="w-5 h-5 mr-2" /> Créer un Devis
                        </button>
                    )}
                </div>
            </div>

            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Rechercher un devis (Ref, Client)..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full pl-4 pr-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-medium" 
                    />
                </div>
            </div>

            {loading ? (
                <div className="p-24 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">Chargement...</div>
            ) : (
                <>
                    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-primary-600 text-white">
                                    <tr>
                                        <th className="px-4 py-4 w-10 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={paginatedQuotes.length > 0 && selectedIds.length === paginatedQuotes.length} 
                                                onChange={(e) => setSelectedIds(e.target.checked ? paginatedQuotes.map(q => q.id) : [])} 
                                                className="h-4 w-4 rounded cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Référence</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Date</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Client</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase">Total</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase">Statut</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {paginatedQuotes.map(quote => (
                                        <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-4 py-4 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.includes(quote.id)} 
                                                    onChange={() => setSelectedIds(prev => prev.includes(quote.id) ? prev.filter(id => id !== quote.id) : [...prev, quote.id])} 
                                                    className="h-4 w-4 text-primary-600 rounded cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{quote.referenceNumber}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{new Date(quote.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{getCustomerName(quote.customerId)}</td>
                                            <td className="px-6 py-4 text-right font-black text-primary-600">{formatCurrency(quote.grandTotal)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(quote)}`}>
                                                    {getStatusLabel(quote)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuItem onClick={() => navigate(`/quotes/edit/${quote.id}`)}>
                                                        <EditIcon className="w-4 h-4 mr-3" /> Modifier / Voir
                                                    </DropdownMenuItem>
                                                    {hasPermission('sales:delete') && (
                                                        <DropdownMenuItem onClick={() => { setQuoteToDelete(quote); setIsDeleteModalOpen(true); }} className="text-red-600">
                                                            <DeleteIcon className="w-4 h-4 mr-3" /> Supprimer
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedQuotes.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-medium">Aucun devis trouvé</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <Pagination 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                        totalItems={filteredQuotes.length} 
                        itemsPerPage={itemsPerPage} 
                    />
                </>
            )}

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Supprimer le devis">
                <div className="p-6">
                    <p className="text-gray-600">Voulez-vous vraiment supprimer le devis <span className="font-bold text-gray-900">{quoteToDelete?.referenceNumber}</span> ?</p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 font-bold">Annuler</button>
                        <button onClick={handleDeleteQuote} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">Supprimer</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Suppression groupée">
                <div className="p-6">
                    <p className="text-gray-600">Voulez-vous vraiment supprimer les <span className="font-bold text-gray-900">{selectedIds.length}</span> devis sélectionnés ?</p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={() => setIsBulkDeleteModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 font-bold">Annuler</button>
                        <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">Supprimer Tout</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default QuotesPage;
