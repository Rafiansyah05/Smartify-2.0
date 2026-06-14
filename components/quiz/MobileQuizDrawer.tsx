'use client';

import { X } from 'lucide-react';

type Props = {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
};

export function MobileQuizDrawer({ open, onClose, title, children }: Props) {
    return (
        <>
            <div
                className={`fixed inset-0 z-[45] bg-black/40 backdrop-blur-[1px] transition-opacity duration-200 lg:hidden ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
                aria-hidden={!open}
                onClick={onClose}
            />
            <aside
                className={`fixed inset-y-0 right-0 z-[50] flex w-[min(100vw-3rem,20rem)] max-w-[20rem] flex-col border-l border-gray-100 bg-white shadow-2xl transition-transform duration-200 ease-out lg:hidden ${open ? 'pointer-events-auto translate-x-0' : 'pointer-events-none translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-hidden={!open}
                aria-labelledby="mobile-quiz-drawer-title"
            >
                <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
                    <h2 id="mobile-quiz-drawer-title" className="truncate pr-2 text-sm font-semibold text-gray-800">
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
                        aria-label="Tutup panel navigasi"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
            </aside>
        </>
    );
}
