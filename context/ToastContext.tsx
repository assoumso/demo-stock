
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    action?: {
        label: string;
        onClick: () => void;
    };
    details?: React.ReactNode;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType, action?: { label: string; onClick: () => void }, details?: React.ReactNode) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [expandedToastId, setExpandedToastId] = useState<string | null>(null);

    const addToast = useCallback((message: string, type: ToastType = 'info', action?: { label: string; onClick: () => void }, details?: React.ReactNode) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prevToasts) => [...prevToasts, { id, message, type, action, details }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
        setExpandedToastId(null);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-10 right-10 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        onMouseEnter={() => toast.details && setExpandedToastId(toast.id)}
                        onMouseLeave={() => setExpandedToastId(null)}
                        className={`pointer-events-auto flex flex-col w-80 max-w-sm p-4 text-gray-500 bg-white rounded-xl shadow-2xl dark:text-gray-400 dark:bg-gray-800 border-l-[6px] transition-all duration-300 ease-out transform translate-y-0 opacity-100 ${
                            toast.type === 'success' ? 'border-green-500 shadow-green-100 dark:shadow-green-900/20' :
                            toast.type === 'error' ? 'border-red-500 shadow-red-100 dark:shadow-red-900/20' :
                            toast.type === 'warning' ? 'border-yellow-500 shadow-yellow-100 dark:shadow-yellow-900/20' :
                            'border-blue-500 shadow-blue-100 dark:shadow-blue-900/20'
                        }`}
                        role="alert"
                        style={{ animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    >
                        <div className="flex items-center space-x-4">
                            <div className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${
                                 toast.type === 'success' ? 'text-green-500 bg-green-100 dark:bg-green-800 dark:text-green-200' :
                                 toast.type === 'error' ? 'text-red-500 bg-red-100 dark:bg-red-800 dark:text-red-200' :
                                 toast.type === 'warning' ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-800 dark:text-yellow-200' :
                                 'text-blue-500 bg-blue-100 dark:bg-blue-800 dark:text-blue-200'
                            }`}>
                                {toast.type === 'success' && <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/></svg>}
                                {toast.type === 'error' && <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z"/></svg>}
                                {toast.type === 'warning' && <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z"/></svg>}
                                {toast.type === 'info' && <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/></svg>}
                            </div>
                            <div className="flex-1 pl-2 text-sm font-normal">{toast.message}</div>
                            <div className="flex items-center gap-1 flex-shrink-0 pointer-events-auto">
                                {toast.action && (
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toast.action?.onClick();
                                            removeToast(toast.id);
                                        }}
                                        className="px-3 py-2 text-xs font-bold rounded-lg transition-colors bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 whitespace-nowrap cursor-pointer z-50 pointer-events-auto"
                                    >
                                        {toast.action.label}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1 hover:bg-gray-100 inline-flex items-center justify-center h-7 w-7 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer z-50 pointer-events-auto"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeToast(toast.id);
                                    }}
                                    aria-label="Close"
                                >
                                    <span className="sr-only">Fermer</span>
                                    <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        {toast.details && (
                            <div className={`transition-all duration-300 overflow-hidden ${expandedToastId === toast.id ? 'max-h-96 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600' : 'max-h-0'}`}>
                                <div className="text-sm">
                                    {toast.details}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
