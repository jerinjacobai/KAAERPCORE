import React from 'react';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
    className?: string;
    label?: string;
}

export const PrintButton: React.FC<PrintButtonProps> = ({ className = '', label = 'Print Report' }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <button
            onClick={handlePrint}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-lg transition-all shadow-sm no-print ${className}`}
            type="button"
        >
            <Printer className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>{label}</span>
        </button>
    );
};
