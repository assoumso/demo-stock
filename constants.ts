
import React from 'react';

// A generic IconProps type for all icons
type IconProps = React.SVGProps<SVGSVGElement>;

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const LogoIcon = (props: IconProps) => (
  React.createElement('svg', { fill: "currentColor", viewBox: "0 0 24 24", ...props },
    React.createElement('path', { d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z" })
  )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const SearchIcon = (props: IconProps) => (
  React.createElement('svg', { fill: "currentColor", viewBox: "0 0 20 20", ...props },
    React.createElement('path', { fillRule: "evenodd", d: "M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z", clipRule: "evenodd" })
  )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const PlusIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "currentColor", viewBox: "0 0 20 20", ...props },
        React.createElement('path', { fillRule: "evenodd", d: "M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z", clipRule: "evenodd" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const DashboardIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const PosIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v-1m0-1V4m0 2.01V5M12 20v-1m0 1v.01M12 18v-1m0-1v-1m0-1v-1m0-1v-1m0-1v-1" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const ProductsIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const InventoryIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 7v10m16-10v10M4 7h16m-9 4h2m-2 4h2M4 7l4-4 4 4M20 7l-4-4-4 4" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const OrdersIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const CustomersIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.28-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.28.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const ReportsIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const UsersIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-1.781-4.121" })
    )
);

export const RolesIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 9a2 2 0 11-4 0 2 2 0 014 0z" }),
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 9h8m-8 4h8m-8 4h4m10 2l-4-4m0 0l-4 4m4-4v12" })
    )
);

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
export const SettingsIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
    )
);

export const WarehouseIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M5 6h14m-5 4h2m-2 4h2m-2 4h2M5 10h2m-2 4h2m-2 4h2" })
    )
);

export const TransferIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" })
    )
);

export const SuppliersIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" })
    )
);

export const BrandIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M5 6h14m-5 4h2m-2 4h2m-2 4h2M5 10h2m-2 4h2m-2 4h2" })
    )
);

export const CategoryIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" })
    )
);

export const UnitIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" })
    )
);


// FIX: Add missing ImageIcon to resolve import error in ProductsPage.tsx
export const ImageIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" })
    )
);

export const EditIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" })
    )
);

export const DeleteIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" })
    )
);

export const EyeIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
    )
);

export const EyeOffIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" })
    )
);

export const EllipsisVerticalIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { d: "M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" })
    )
);

export const DocumentTextIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" })
    )
);

export const DuplicateIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" })
    )
);

export const ChevronDownIcon = (props: IconProps) => (
  React.createElement('svg', { fill: "currentColor", viewBox: "0 0 20 20", ...props },
    React.createElement('path', { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" })
  )
);

export const DownloadIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" })
    )
);

export const UploadIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" })
    )
);

export const AdjustmentsIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h4m-2-2v4" })
    )
);

export const PurchaseIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" })
    )
);

export const PaymentIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" })
    )
);

export const CreditCardIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" })
    )
);

export const BarcodeIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { d: "M4 6h2v12H4zm4 0h1v12H8zm2 0h2v12h-2zm3 0h1v12h-1zm2 0h3v12h-3z" })
    )
);

export const ReturnIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 17l-4 4m0 0l-4-4m4 4V3" }),
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7l4-4m0 0l4 4m-4-4v12" })
    )
);

export const PdfIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
      React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.242 0 3 3 0 00-4.242 0z" })
    )
);

export const PrintIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H7a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm2-9V5a2 2 0 00-2-2H9a2 2 0 00-2 2v3" })
    )
);

export const ArrowLeftIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 19l-7-7m0 0l7-7m-7 7h18" })
    )
);

export const ChartBarIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9.5M9 9.5a2.5 2.5 0 015 0V19m-5-9.5a2.5 2.5 0 005 0m-5 0V3m5 6.5V3m0 0a2.5 2.5 0 015 0V19" })
    )
);

export const TrendingUpIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" })
    )
);

export const ShoppingCartIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" })
    )
);

export const WarningIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" })
    )
);

export const ShieldCheckIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" })
    )
);

export const SparklesIcon = (props: IconProps) => (
    React.createElement('svg', { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", ...props },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 3v4M3 5h4M6 17v4m-2-2h4m-4-7a2 2 0 114 0 2 2 0 01-4 0zm11 0a2 2 0 114 0 2 2 0 01-4 0zM7 11a2 2 0 100-4 2 2 0 000 4zm11-4a2 2 0 100-4 2 2 0 000 4z" })
    )
);

export const WhatsappIcon = (props: IconProps) => (
    React.createElement('svg', { fill: "currentColor", viewBox: "0 0 24 24", ...props },
        React.createElement('path', { d: "M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.37 21.82 12.04 21.82C17.5 21.82 21.95 17.37 21.95 11.91C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.04 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.71 20.28 11.91C20.28 16.47 16.65 20.1 12.04 20.1C10.5 20.1 9.04 19.68 7.8 18.96L7.54 18.82L4.31 19.69L5.2 16.54L5.05 16.28C4.26 15 3.8 13.47 3.8 11.91C3.8 7.35 7.43 3.67 12.04 3.67M9.15 7.6C8.95 7.6 8.78 7.64 8.63 7.89C8.49 8.14 8 9.03 8 10.1C8 11.17 8.63 12.19 8.78 12.37C8.93 12.54 10.2 14.83 12.47 15.76C14.74 16.69 14.74 16.2 15.09 16.16C15.44 16.12 16.47 15.54 16.72 14.93C16.97 14.32 16.97 13.8 16.92 13.67C16.87 13.54 16.69 13.47 16.44 13.34C16.19 13.22 14.91 12.59 14.68 12.5C14.45 12.41 14.28 12.37 14.1 12.62C13.93 12.87 13.43 13.45 13.28 13.63C13.13 13.8 12.98 13.82 12.73 13.7C12.48 13.57 11.59 13.26 10.54 12.33C9.72 11.6 9.15 10.71 9 10.43C8.85 10.16 8.97 10.02 9.1 9.89C9.22 9.77 9.37 9.57 9.52 9.42C9.67 9.27 9.72 9.15 9.82 8.95C9.92 8.75 9.87 8.58 9.8 8.45C9.73 8.33 9.25 7.7 9.15 7.6Z" })
    )
);
