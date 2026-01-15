
import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogoIcon } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { menuConfig } from '../config/menu';


interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const location = useLocation();
  const { pathname } = location;
  const { user, hasPermission } = useAuth();
  const { companyName, logoUrl } = useTheme();

  const trigger = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLDivElement>(null);

  // close on click outside
  useEffect(() => {
    const clickHandler = ({ target }: MouseEvent) => {
      if (!sidebar.current || !trigger.current) return;
      if (!sidebarOpen || sidebar.current.contains(target as Node) || trigger.current.contains(target as Node)) return;
      setSidebarOpen(false);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  });

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({ keyCode }: KeyboardEvent) => {
      if (!sidebarOpen || keyCode !== 27) return;
      setSidebarOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  });
  
  return (
    <div>
      {/* Sidebar backdrop (mobile only) */}
      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-30 z-40 lg:hidden lg:z-auto transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      ></div>

      {/* Sidebar */}
      <div
        id="sidebar"
        ref={sidebar}
        className={`flex flex-col absolute z-40 left-0 top-0 lg:static lg:left-auto lg:top-auto lg:translate-x-0 h-screen overflow-y-auto no-scrollbar w-64 shrink-0 bg-gray-800 p-4 transition-all duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-64'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between mb-10 pr-3 sm:px-2">
          {/* Logo & Name */}
          <NavLink end to="/" className="flex-1 min-w-0 mr-4">
            <div className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0 overflow-hidden">
                    {logoUrl ? (
                        <img 
                            src={logoUrl} 
                            alt="Logo" 
                            className="w-full h-full object-contain" 
                        />
                    ) : (
                        <LogoIcon className="w-8 h-8 text-primary-500 shrink-0" />
                    )}
                </div>
                <span 
                    className="ml-3 text-base font-bold text-white uppercase truncate overflow-hidden whitespace-nowrap"
                    title={companyName}
                >
                    {companyName}
                </span>
            </div>
          </NavLink>

          {/* Close button (Mobile only) */}
          <button
            ref={trigger}
            className="lg:hidden text-gray-500 hover:text-gray-400 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(!sidebarOpen);
            }}
            aria-controls="sidebar"
            aria-expanded={sidebarOpen}
          >
            <span className="sr-only">Close sidebar</span>
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.7 18.7l1.4-1.4L7.8 13H20v-2H7.8l4.3-4.3-1.4-1.4L4 12z" />
            </svg>
          </button>
        </div>

        {/* Links */}
        <div className="space-y-8">
            {menuConfig.map((group) => {
                const visibleItems = group.items.filter(item => hasPermission(item.to));
                if (visibleItems.length === 0) return null;

                return (
                    <div key={group.title}>
                        <h3 className={`text-xs uppercase font-semibold pl-3 ${group.colorClass}`}>{group.title}</h3>
                        <ul className="mt-3">
                        {visibleItems.map(item => (
                           <MenuItem key={item.to} to={item.to} icon={item.icon} text={item.text} currentPath={pathname} />
                        ))}
                        </ul>
                    </div>
                )
            })}
        </div>
      </div>
    </div>
  );
};

interface MenuItemProps {
    to: string;
    icon: React.ReactElement;
    text: string;
    currentPath: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ to, icon, text, currentPath }) => {
    const targetPath = to === 'dashboard' ? '/' : `/${to}`;
    const isActive = currentPath === targetPath || (currentPath.startsWith(targetPath) && targetPath !== '/');

    return (
        <li className={`px-3 py-2 rounded-sm mb-0.5 last:mb-0 ${isActive && 'bg-gray-900'}`}>
            <NavLink
                end
                to={targetPath}
                className={`block text-gray-200 hover:text-white truncate transition duration-150 ${
                isActive && 'hover:text-gray-200'
                }`}
            >
                <div className="flex items-center">
                    {React.cloneElement<{ className?: string }>(icon, { className: `shrink-0 h-6 w-6 ${isActive ? 'text-primary-500' : 'text-gray-400'}` })}
                    <span className="text-sm font-medium ml-3 duration-200">
                        {text}
                    </span>
                </div>
            </NavLink>
      </li>
    );
};

export default Sidebar;
