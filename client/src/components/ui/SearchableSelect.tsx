import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HiChevronDown, HiSearch, HiX } from 'react-icons/hi';

export interface SelectOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: SelectOption[];
    value: string | string[]; // Support single or multiple
    onChange: (value: any) => void; // Any to allow string or string[]
    multiple?: boolean;
    placeholder?: string;
    allLabel?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
    hasError?: boolean;
    dropUp?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    multiple = false,
    placeholder = 'Select...',
    allLabel,
    className = '',
    disabled = false,
    required = false,
    hasError = false,
    dropUp,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [calculatedDropUp, setCalculatedDropUp] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Normalize value to array if multiple
    const values = multiple ? (Array.isArray(value) ? value : value ? [value] : []) : [value as string];

    const selectedLabels = values
        .map(v => options.find(o => o.value === v)?.label)
        .filter(Boolean) as string[];

    const displayValue = multiple
        ? selectedLabels.length > 0
            ? selectedLabels.join(', ')
            : (allLabel || placeholder)
        : (options.find(o => o.value === value)?.label || allLabel || placeholder);

    const filtered = search.trim()
        ? options.filter(o => {
            const label = o.label.toLowerCase();
            const searchWords = search.toLowerCase().split(' ').filter(word => word.length > 0);
            return searchWords.every(word => label.includes(word));
        })
        : options;

    const displayList = allLabel && !multiple
        ? [{ value: '', label: allLabel } as SelectOption, ...filtered]
        : filtered;

    useEffect(() => {
        setHighlightedIndex(0);
    }, [search]);

    useEffect(() => {
        if (open && containerRef.current) {
            if (dropUp !== undefined) {
                setCalculatedDropUp(dropUp);
                return;
            }
            const rect = containerRef.current.getBoundingClientRect();
            const scrollParent = containerRef.current.closest('.overflow-y-auto') || containerRef.current.closest('.overflow-auto');
            let spaceBelow = window.innerHeight - rect.bottom;
            if (scrollParent) {
                const parentRect = scrollParent.getBoundingClientRect();
                spaceBelow = Math.min(spaceBelow, parentRect.bottom - rect.bottom);
            }
            if (spaceBelow < 260 && rect.top > 180) {
                setCalculatedDropUp(true);
            } else {
                setCalculatedDropUp(false);
            }
        }
    }, [open, dropUp]);

    useEffect(() => {
        if (open && searchRef.current) {
            searchRef.current.focus();
        }
    }, [open]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const scrollIntoView = useCallback((index: number) => {
        if (listRef.current) {
            const item = listRef.current.children[index] as HTMLElement;
            item?.scrollIntoView({ block: 'nearest' });
        }
    }, []);

    const handleSelect = (opt: SelectOption) => {
        if (multiple) {
            const newValues = values.includes(opt.value)
                ? values.filter(v => v !== opt.value)
                : [...values, opt.value];
            onChange(newValues);
            // Don't close on multi-select
        } else {
            onChange(opt.value);
            setOpen(false);
            setSearch('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                setOpen(true);
            }
            return;
        }
        switch (e.key) {
            case 'ArrowDown': {
                const next = Math.min(highlightedIndex + 1, displayList.length - 1);
                setHighlightedIndex(next);
                scrollIntoView(next);
                e.preventDefault();
                break;
            }
            case 'ArrowUp': {
                const prev = Math.max(highlightedIndex - 1, 0);
                setHighlightedIndex(prev);
                scrollIntoView(prev);
                e.preventDefault();
                break;
            }
            case 'Enter': {
                const selected = displayList[highlightedIndex];
                if (selected) {
                    handleSelect(selected);
                }
                e.preventDefault();
                break;
            }
            case 'Escape': {
                setOpen(false);
                setSearch('');
                break;
            }
        }
    };

    const isAllSelected = multiple && values.length === options.length;

    const toggleAll = () => {
        if (isAllSelected) onChange([]);
        else onChange(options.map(o => o.value));
    };

    return (
        <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
            <button
                type="button"
                disabled={disabled}
                data-error-field={hasError ? 'true' : undefined}
                onClick={() => {
                    if (!disabled) setOpen(prev => !prev);
                }}
                className={`
                    w-full flex items-center justify-between gap-2
                    px-3 py-2 rounded-xl border text-sm font-medium
                    transition-all duration-150 focus:outline-none
                    ${disabled
                        ? 'bg-surface-100 text-surface-400 border-surface-200 cursor-not-allowed'
                        : open
                            ? 'bg-white border-primary-500 ring-2 ring-primary-100 text-surface-900'
                            : hasError
                                ? 'bg-white border-red-500 focus:ring-red-400 text-surface-900'
                                : 'bg-white border-surface-200 text-surface-700 hover:border-surface-300'
                    }
                `}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <div className="flex items-center gap-2 truncate">
                    {multiple ? (
                        <div className="flex items-center gap-1.5 truncate">
                            <div className="flex-shrink-0 w-4 h-4 rounded bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold">
                                {values.length}
                            </div>
                            <span className={`truncate ${values.length === 0 ? 'text-surface-400' : 'text-surface-900'}`}>
                                {displayValue}
                            </span>
                        </div>
                    ) : (
                        <>
                            <HiSearch className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                            <span className={`truncate ${!value && !allLabel ? 'text-surface-400' : 'text-surface-900'}`}>
                                {displayValue}
                            </span>
                        </>
                    )}
                </div>

                <input
                    type="text"
                    required={required}
                    value={multiple ? (values.length > 0 ? 'selected' : '') : (value as string)}
                    onChange={() => { }}
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                    tabIndex={-1}
                />

                <span className="flex items-center gap-1 flex-shrink-0">
                    <HiChevronDown
                        className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    />
                </span>
            </button>

            {open && (
                <div className={`
                    absolute z-50 left-0 right-0
                    ${calculatedDropUp
                        ? 'bottom-full mb-1 slide-in-from-bottom-1'
                        : 'top-full mt-1 slide-in-from-top-1'}
                    bg-white border border-surface-200 rounded-xl shadow-lg shadow-surface-900/10
                    animate-in fade-in duration-150
                    overflow-hidden
                `}>
                    <div className="p-2 border-b border-surface-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-surface-50 rounded-lg">
                            <HiSearch className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={multiple ? "Search companies..." : "Start typing to search..."}
                                className="flex-1 bg-transparent text-sm text-surface-700 placeholder-surface-400 outline-none min-w-0"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-surface-400 hover:text-surface-600">
                                    <HiX className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        {multiple && !search && (
                            <div className="mt-2 px-2 flex justify-between items-center">
                                <button
                                    onClick={toggleAll}
                                    className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider"
                                >
                                    {isAllSelected ? 'Deselect All' : 'Select All'}
                                </button>
                                <span className="text-[10px] text-surface-400">{values.length} selected</span>
                            </div>
                        )}
                    </div>

                    <ul
                        ref={listRef}
                        role="listbox"
                        className="py-1 max-h-56 overflow-y-auto overscroll-contain"
                    >
                        {displayList.length === 0 ? (
                            <li className="px-3 py-3 text-sm text-surface-400 text-center">
                                No results for "{search}"
                            </li>
                        ) : (
                            displayList.map((opt, idx) => {
                                const isSelected = values.includes(opt.value) || (opt.value === '' && values.length === 0);
                                const isHighlighted = idx === highlightedIndex;
                                return (
                                    <li
                                        key={opt.value === '' ? '__all__' : opt.value}
                                        role="option"
                                        aria-selected={isSelected}
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                        onClick={() => handleSelect(opt)}
                                        className={`
                                            flex items-center justify-between
                                            px-3 py-2 text-sm cursor-pointer select-none
                                            transition-colors duration-100
                                            ${isSelected && !multiple
                                                ? 'bg-primary-50 text-primary-700 font-medium'
                                                : isHighlighted
                                                    ? 'bg-surface-50 text-surface-800'
                                                    : 'text-surface-700'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {multiple && (
                                                <input
                                                    type="checkbox"
                                                    checked={values.includes(opt.value)}
                                                    readOnly
                                                    className="rounded border-surface-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                                                />
                                            )}
                                            <span className={`truncate ${isSelected && multiple ? 'font-semibold text-surface-900' : ''}`}>
                                                {opt.label}
                                            </span>
                                        </div>
                                        {isSelected && !multiple && (
                                            <svg className="w-4 h-4 text-primary-600 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </li>
                                );
                            })
                        )}
                    </ul>

                    {options.length > 0 && filtered.length < options.length && (
                        <div className="px-3 py-1.5 border-t border-surface-100 bg-surface-50">
                            <p className="text-xs text-surface-400">
                                Showing {filtered.length} of {options.length}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
