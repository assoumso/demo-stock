import React, { ReactNode, useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const clickHandler = (e: MouseEvent) => {
        if(modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    }

    if (isOpen) {
      window.addEventListener('keydown', keyHandler);
      document.addEventListener('mousedown', clickHandler);
    }

    return () => {
      window.removeEventListener('keydown', keyHandler);
      document.removeEventListener('mousedown', clickHandler);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div ref={modalRef} className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${maxWidth}`}>
        <div className="flex justify-between items-center border-b pb-3 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;