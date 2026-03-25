import React, { useState } from 'react';
import StockAdjustmentForm from '../components/StockAdjustmentForm';
import StockAdjustmentHistory from '../components/StockAdjustmentHistory';
import { useAuth } from '../hooks/useAuth';

const StockAdjustmentsPage: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    if (!user) return null;

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                        Ajustements de Stock
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">
                        Gérez les entrées et sorties manuelles de stock
                    </p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner">
                    <button 
                        onClick={() => setActiveTab('new')}
                        className={`px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'new' ? 'bg-white dark:bg-gray-700 shadow-lg text-primary-600 dark:text-primary-400 transform scale-105' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Saisie
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'history' ? 'bg-white dark:bg-gray-700 shadow-lg text-primary-600 dark:text-primary-400 transform scale-105' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Historique
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="transition-all duration-500 ease-in-out">
                {activeTab === 'new' ? (
                    <div className="animate-fade-in-up">
                        <StockAdjustmentForm />
                    </div>
                ) : (
                    <div className="animate-fade-in-up">
                        <StockAdjustmentHistory />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockAdjustmentsPage;