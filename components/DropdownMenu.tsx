
import React, { useState, useRef, useEffect, ReactNode, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVerticalIcon } from '../constants';

interface DropdownMenuContextType {
  closeMenu: () => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | null>(null);

const useDropdownMenu = () => {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('useDropdownMenu must be used within a DropdownMenu');
  }
  return context;
};

interface DropdownMenuProps {
  children: ReactNode;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.right + window.scrollX
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => setIsOpen(false);

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ closeMenu: () => setIsOpen(false) }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleDropdown}
        className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
      >
        <EllipsisVerticalIcon className="w-5 h-5" />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: 'translateX(-100%)',
          }}
          className="mt-2 w-56 rounded-xl shadow-2xl bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-[9999] overflow-hidden border dark:border-gray-700"
          role="menu"
        >
          {/* L'action de clic ici ne ferme plus automatiquement le menu */}
          <div className="py-1">
            {children}
          </div>
        </div>,
        document.body
      )}
    </DropdownMenuContext.Provider>
  );
};

interface DropdownMenuItemProps {
    onClick: () => void;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
}

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({ onClick, children, className = '', disabled = false }) => {
  const { closeMenu } = useDropdownMenu();
  
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick();
        closeMenu(); // Fermer le menu après l'action
      }}
      disabled={disabled}
      className={`w-full text-left flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/40 hover:text-primary-600 dark:hover:text-primary-400 transition-all ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
      role="menuitem"
    >
      {children}
    </button>
  );
};

export default DropdownMenu;
