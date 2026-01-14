import React from 'react';
import { mockOrders } from '../data/mockData';
import { Order } from '../types';

const OrdersPage: React.FC = () => {
  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Gestion des Commandes</h1>
      <div className="mt-4">
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
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">{order.orderNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.customerName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(order.total)}</td>
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
        </table>
      </div>
    </div>
  );
};

export default OrdersPage;