
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, query, orderBy, runTransaction } from 'firebase/firestore';
import { SupplierCreditNote, Supplier, AppSettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Pagination } from '../components/Pagination';
import { PlusIcon, DeleteIcon, SearchIcon, PrintIcon } from '../constants';
import Modal from '../components/Modal';
import { SupplierCreditNotePrint } from '../components/SupplierCreditNotePrint';
import { useReactToPrint } from 'react-to-print';
import { formatCurrency } from '../utils/formatters';

const SupplierCreditNotesPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [creditNotes, setCreditNotes] = useState<SupplierCreditNote[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    // Deletion
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<SupplierCreditNote | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Printing
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [noteToPrint, setNoteToPrint] = useState<SupplierCreditNote | null>(null);
    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef });

    useEffect(() => {
        fetchData();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const snap = await getDocs(collection(db, "appSettings"));
            if (!snap.empty) setSettings({ id: snap.docs[0].id, ...snap.docs[0].data() } as AppSettings);
        } catch (err) {
            console.error("Error fetching settings:", err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [notesSnap, suppliersSnap] = await Promise.all([
                getDocs(query(collection(db, "supplierCreditNotes"), orderBy("date", "desc"))),
                getDocs(collection(db, "suppliers"))
            ]);
            
            const notesData = notesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierCreditNote));
            const suppliersData = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));

            setCreditNotes(notesData);
            setSuppliers(suppliersData);
        } catch (err) {
            console.error("Error fetching credit notes:", err);
        } finally {
            setLoading(false);
        }
    };

    const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Fournisseur Inconnu';

    const filteredNotes = useMemo(() => {
        return creditNotes.filter(note => {
            const supplierName = getSupplierName(note.supplierId).toLowerCase();
            const ref = note.referenceNumber.toLowerCase();
            const search = searchTerm.toLowerCase();
            return supplierName.includes(search) || ref.includes(search);
        });
    }, [creditNotes, suppliers, searchTerm]);

    const paginatedNotes = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredNotes.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredNotes, currentPage]);

    const totalPages = Math.ceil(filteredNotes.length / ITEMS_PER_PAGE);

    const totalPageAmount = useMemo(() => {
        return paginatedNotes.reduce((sum, note) => sum + note.amount, 0);
    }, [paginatedNotes]);

    const totalGlobalAmount = useMemo(() => {
        return filteredNotes.reduce((sum, note) => sum + note.amount, 0);
    }, [filteredNotes]);

    const handleDeleteClick = (note: SupplierCreditNote) => {
        setNoteToDelete(note);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!noteToDelete) return;
        setIsDeleting(true);
        try {
            await runTransaction(db, async (transaction) => {
                // 1. Get current supplier data
                const supplierRef = doc(db, "suppliers", noteToDelete.supplierId);
                const supplierSnap = await transaction.get(supplierRef);
                
                if (!supplierSnap.exists()) throw new Error("Fournisseur introuvable");
                
                const supplierData = supplierSnap.data() as Supplier;
                const currentCredit = supplierData.creditBalance || 0;

                // 2. Verify if we can deduct the credit (has it been used?)
                if (currentCredit < noteToDelete.amount) {
                    throw new Error(`Impossible de supprimer cet avoir : le crédit a déjà été utilisé (Solde actuel: ${formatCurrency(currentCredit)}).`);
                }

                // 3. Update supplier balance
                transaction.update(supplierRef, {
                    creditBalance: currentCredit - noteToDelete.amount
                });

                // 4. Delete the note
                const noteRef = doc(db, "supplierCreditNotes", noteToDelete.id);
                transaction.delete(noteRef);
                
                // 5. Delete linked payment if exists (Purchase Payment)
                if (noteToDelete.paymentId) {
                     const paymentRef = doc(db, "purchasePayments", noteToDelete.paymentId);
                     transaction.delete(paymentRef);
                }
            });
            
            setCreditNotes(prev => prev.filter(n => n.id !== noteToDelete.id));
            setDeleteModalOpen(false);
            setNoteToDelete(null);
        } catch (err: any) {
            alert("Erreur lors de la suppression : " + err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR');

    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Avoirs Fournisseurs</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Gestion des notes de crédit et retours fournisseurs</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => navigate('/supplier-credit-notes/new')}
                        className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg transition-all hover:scale-105"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Nouvel Avoir
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Rechercher par fournisseur ou référence..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Référence</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Fournisseur</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Montant</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Motif</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
                            ) : paginatedNotes.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Aucun avoir trouvé.</td></tr>
                            ) : (
                                paginatedNotes.map((note) => (
                                    <tr key={note.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">{formatDate(note.date)}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-primary-600 whitespace-nowrap">{note.referenceNumber}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{getSupplierName(note.supplierId)}</td>
                                        <td className="px-6 py-4 text-right text-sm font-black text-green-600 whitespace-nowrap">{formatCurrency(note.amount)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">{note.reason}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => { setNoteToPrint(note); setPrintModalOpen(true); }}
                                                    className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="Imprimer"
                                                >
                                                    <PrintIcon className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteClick(note)}
                                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <DeleteIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                            <tr className="bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
                                <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Page</td>
                                <td className="px-6 py-3 text-right text-xs font-black text-green-600">{formatCurrency(totalPageAmount)}</td>
                                <td colSpan={2}></td>
                            </tr>
                            <tr className="bg-blue-100 dark:bg-blue-900/40">
                                <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-primary-600">Total Global</td>
                                <td className="px-6 py-3 text-right text-xs font-black text-green-600">{formatCurrency(totalGlobalAmount)}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={filteredNotes.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                        />
                    </div>
                )}
            </div>

            <Modal
                isOpen={deleteModalOpen}
                onClose={() => !isDeleting && setDeleteModalOpen(false)}
                title="Confirmer la suppression"
            >
                <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Êtes-vous sûr de vouloir supprimer cet avoir ? <br/>
                        Le montant ({noteToDelete ? formatCurrency(noteToDelete.amount) : ''}) sera déduit du solde du fournisseur.
                    </p>
                    <div className="flex justify-end gap-4">
                        <button
                            onClick={() => setDeleteModalOpen(false)}
                            disabled={isDeleting}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg flex items-center"
                        >
                            {isDeleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>}
                            Supprimer
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Print Modal */}
            <Modal
                isOpen={printModalOpen}
                onClose={() => setPrintModalOpen(false)}
                title="IMPRIMER AVOIR FOURNISSEUR"
                maxWidth="max-w-4xl"
            >
                <div className="flex flex-col items-center p-6">
                    <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-700 p-4 rounded-xl mb-6 shadow-inner">
                        {noteToPrint && (
                            <div className="transform scale-90 origin-top">
                                <SupplierCreditNotePrint 
                                    ref={printRef}
                                    note={noteToPrint} 
                                    supplier={suppliers.find(c => c.id === noteToPrint.supplierId)!} 
                                    settings={settings} 
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4 w-full justify-end">
                        <button
                            onClick={() => setPrintModalOpen(false)}
                            className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-bold uppercase tracking-wide"
                        >
                            Fermer
                        </button>
                        <button
                            onClick={handlePrint}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-wide shadow-lg flex items-center"
                        >
                            <PrintIcon className="w-5 h-5 mr-2" />
                            Imprimer
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SupplierCreditNotesPage;
