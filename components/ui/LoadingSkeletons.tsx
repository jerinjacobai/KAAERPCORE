import React from 'react';

// Shimmering base block
export const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-slate-200 dark:bg-zinc-800 rounded-xl ${className}`} />
);

export const CardSkeleton: React.FC = () => {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
                <Shimmer className="h-10 w-10 rounded-xl" />
                <Shimmer className="h-4 w-16" />
            </div>
            <div className="space-y-2">
                <Shimmer className="h-3 w-1/3" />
                <Shimmer className="h-8 w-2/3" />
            </div>
            <div className="pt-2 border-t border-slate-50 dark:border-zinc-800/50">
                <Shimmer className="h-3 w-1/2" />
            </div>
        </div>
    );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-50 dark:border-zinc-800 flex justify-between items-center">
                <Shimmer className="h-6 w-1/4" />
                <div className="flex gap-2">
                    <Shimmer className="h-9 w-20 rounded-lg" />
                    <Shimmer className="h-9 w-20 rounded-lg" />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 text-left">
                            {Array.from({ length: cols }).map((_, i) => (
                                <th key={i} className="px-6 py-4">
                                    <Shimmer className="h-4 w-16" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {Array.from({ length: rows }).map((_, r) => (
                            <tr key={r}>
                                {Array.from({ length: cols }).map((_, c) => (
                                    <td key={c} className="px-6 py-4">
                                        <Shimmer className="h-4 w-full max-w-[120px]" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="p-8 space-y-8 animate-page-enter">
            {/* Header Banner Skeleton */}
            <div className="relative overflow-hidden rounded-[2rem] p-8 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 h-48 flex flex-col justify-end gap-3">
                <div className="h-8 w-1/3 bg-slate-200 dark:bg-zinc-700 rounded-xl" />
                <div className="h-4 w-1/4 bg-slate-200 dark:bg-zinc-700 rounded-lg" />
            </div>

            {/* Grid of Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
};
