import React from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineX } from 'react-icons/hi';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;

    const sizeClass = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
    }[size];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full ${sizeClass} bg-white rounded-2xl shadow-2xl animate-slide-up max-h-[80vh] flex flex-col`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                    <h3 className="text-lg font-semibold text-surface-900">{title}</h3>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-6 py-4 overflow-y-auto flex-1">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
