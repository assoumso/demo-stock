import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Expense, ExpenseCategory } from '../types';
import { PlusIcon, SearchIcon, FilterIcon, CalendarIcon, TrashIcon, EditIcon, DocumentTextIcon, SettingsIcon } from '../constants';
import { formatCurrency, formatDate } from '../utils/formatters';
import { supabase } from '../supabase';
import { ExpenseCategoriesModal } from '../components/ExpenseCategoriesModal';

const ExpensesPage: React.FC = () => {
    const navigate = useNavigate();
    const { expenses, expenseCategories, expensesLoading, refreshData } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const ITEMS_PER_PAGE = 20;

    // Refresh data on mount
    useEffect(() => {
        refreshData(['expenses']);
    }, []);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const matchesSearch = 
                (expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
                (expense.reference?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
                (expense.paidTo?.toLowerCase().includes(searchTerm.toLowerCase()) || '');
            
            const matchesCategory = selectedCategory === 'all' || expense.categoryId === selectedCategory;
            
            let matchesDate = true;
            if (startDate) {
                matchesDate = matchesDate && new Date(expense.date) >= new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchesDate = matchesDate && new Date(expense.date) <= end;
            }

            return matchesSearch && matchesCategory && matchesDate;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [expenses, searchTerm, selectedCategory, startDate, endDate]);

    const totalAmount = useMemo(() => {
        return filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    }, [filteredExpenses]);

    const paginatedExpenses = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredExpenses, currentPage]);

    const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);

    const getCategoryName = (id: string) => {
        const category = expenseCategories.find(c => c.id === id);
        return category ? category.name : 'Inconnue';
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
            try {
                const { error } = await supabase.from('expenses').delete().eq('id', id);
                if (error) throw error;
                refreshData(['expenses']);
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                alert('Erreur lors de la suppression de la dépense');
            }
        }
    };

    if (expensesLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center animate-pulse">
                    <div className="text-4xl mb-4">💰</div>
                    <div className="text-sm font-black text-gray-400 uppercase tracking-widest">Chargement des dépenses...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            Gestion des Dépenses
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Suivez et gérez vos dépenses professionnelles
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsCategoryModalOpen(true)}
                            className="flex items-center justify-center px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 rounded-xl font-bold transition-all shadow-sm"
                        >
                            <SettingsIcon className="w-5 h-5 mr-2" />
                            Gérer Catégories
                        </button>
                        <button
                            onClick={() => navigate('/expenses/new')}
                            className="flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-red-500/30 group"
                        >
                            <PlusIcon className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                            Nouvelle Dépense
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Rechercher (Description, Réf, Bénéficiaire)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        <div className="relative">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none transition-all"
                            >
                                <option value="all">Toutes les catégories</option>
                                {expenseCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        <div className="relative">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                            />
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        <div className="relative">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                            />
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-500/20">
                        <p className="text-red-100 text-xs font-bold uppercase tracking-widest mb-1">Total Dépenses</p>
                        <h3 className="text-3xl font-black">{formatCurrency(totalAmount)}</h3>
                        <p className="text-red-100 text-xs mt-2 opacity-80">{filteredExpenses.length} transactions</p>
                    </div>
                    {/* Add more stats if needed */}
                </div>

                {/* List */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Catégorie</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Bénéficiaire</th>
                                    <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Montant</th>
                                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedExpenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <DocumentTextIcon className="w-12 h-12 mb-3 opacity-20" />
                                                <p className="font-medium">Aucune dépense trouvée</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedExpenses.map((expense) => (
                                        <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 font-medium">
                                                {formatDate(expense.date)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]" title={expense.description}>
                                                    {expense.description || '-'}
                                                </div>
                                                {expense.reference && (
                                                    <div className="text-xs text-gray-400 mt-0.5">Réf: {expense.reference}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                    {getCategoryName(expense.categoryId)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                                {expense.paidTo || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-red-600 text-right">
                                                {formatCurrency(expense.amount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <button
                                                        onClick={() => navigate(`/expenses/edit/${expense.id}`)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="Modifier"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(expense.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-center">
                            <div className="flex space-x-2">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                                            currentPage === page
                                                ? 'bg-red-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <ExpenseCategoriesModal 
                isOpen={isCategoryModalOpen} 
                onClose={() => setIsCategoryModalOpen(false)} 
            />
        </div>
    );
};

export default ExpensesPage;
