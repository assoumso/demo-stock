import React, { useState, useRef } from 'react';
import { mockOrders } from '../data/mockData';
import { Order } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import Modal from '../components/Modal';
import { OrderListPrint } from '../components/OrderListPrint';
import { PrintIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';

const OrdersPage: React.FC = () => {
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Journal_Commandes_${new Date().toISOString().split('T')[0]}`,
  });

  const totalAmount = mockOrders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Gestion des Commandes</h1>
        <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-xl font-bold uppercase text-xs shadow-lg hover:bg-black transition-all"
        >
            <PrintIcon className="w-5 h-5 mr-2" /> Imprimer
        </button>
      </div>
      
      <div className="mt-4 bg-white dark:bg-gray-800 shadow-xl rounded-3xl overflow-hidden border dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-primary-600">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">N° Commande</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Client</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Total</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Statut</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {mockOrders.map((order: Order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">{order.orderNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.customerName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatDate(order.createdAt)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-bold">{formatCurrency(order.total)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'Payée' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                        order.status === 'En attente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                    }`}>{order.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-700">
            <tr>
                <td colSpan={3} className="px-6 py-4 text-right text-xs font-black uppercase text-gray-500 tracking-wider">Total</td>
                <td className="px-6 py-4 text-sm font-black text-gray-900 dark:text-white">{formatCurrency(totalAmount)}</td>
                <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {/* Print Modal */}
      <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="IMPRIMER LISTE COMMANDES" maxWidth="max-w-4xl">
          <div className="flex flex-col items-center p-6">
              <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-700 p-4 rounded-xl mb-6 shadow-inner max-h-[70vh]">
                  <div className="transform scale-90 origin-top">
                       <OrderListPrint 
                          ref={printRef}
                          orders={mockOrders}
                          // settings={settings} // Settings not available in mock page
                       />
                  </div>
              </div>
              <div className="flex gap-4 w-full justify-end">
                  <button onClick={() => setIsPrintModalOpen(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-bold uppercase">Fermer</button>
                  <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase shadow-lg flex items-center"><PrintIcon className="w-5 h-5 mr-2" /> Imprimer</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default OrdersPage;