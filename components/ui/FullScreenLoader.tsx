import React from 'react';
import { KAA_LOGO_URL } from '../../constants';

export const FullScreenLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 transition-colors duration-500 overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/15 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[120px]"></div>
            </div>

            <div className="relative flex flex-col items-center gap-6 z-10">
                <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-indigo-500/30 rounded-[2.5rem] blur-2xl animate-pulse"></div>
                    <div className="relative bg-white border border-slate-100 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xl rounded-[2.5rem] p-6 flex items-center justify-center h-28 w-28 md:h-32 md:w-32 transition-transform duration-500 animate-pulse">
                        <img src={KAA_LOGO_URL} alt="Kaa Logo" className="h-full w-full object-contain" />
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tight">Preparing your KAA experience...</h2>
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-[0.2em] animate-pulse">Loading your workspace...</p>
                </div>
            </div>
        </div>
    );
};
