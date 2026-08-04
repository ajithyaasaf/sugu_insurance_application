export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatShortCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(amount);
};

export const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '—';
        return new Intl.DateTimeFormat('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(d);
    } catch (e) {
        return '—';
    }
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '—';
        return new Intl.DateTimeFormat('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(d);
    } catch (e) {
        return '—';
    }
};

export const formatDateInput = (date: string | Date): string => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
};

export const formatRelativeDate = (date: string | Date): string => {
    const now = new Date();
    const target = new Date(date);
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 30) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -30) return `${Math.abs(diffDays)} days ago`;
    return formatDate(date);
};

export const getStatusColor = (status: string): string => {
    const s = status.toLowerCase();
    const map: Record<string, string> = {
        active: 'badge-success',
        paid: 'badge-success',
        completed: 'badge-success',
        converted: 'badge-success',
        approved: 'badge-success',
        settled: 'badge-success',
        new: 'badge-info',
        pending: 'badge-warning',
        interested: 'badge-info',
        contacted: 'badge-info',
        filed: 'badge-info',
        partial: 'badge-warning',
        overdue: 'badge-danger',
        expired: 'badge-danger',
        cancelled: 'badge-danger',
        lost: 'badge-danger',
        rejected: 'badge-danger',
        missed: 'badge-danger',
    };
    return map[s] || 'badge-default';
};

export const daysUntil = (date: string | Date): number => {
    const now = new Date();
    const target = new Date(date);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const truncate = (str: string, length: number = 40): string => {
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
};

/**
 * Scrolls the modal's own overflow container to the first field
 * that has a validation error (marked with data-error-field="true").
 * Falls back to a full-page scrollIntoView if no modal overlay is found.
 */
export const scrollToFirstError = () => {
    setTimeout(() => {
        const firstError = document.querySelector<HTMLElement>('[data-error-field="true"]');
        if (!firstError) return;

        // Forms live inside a modal with its own overflow-y-auto scroll container.
        // scrollIntoView() only works on the document scroll root, not a nested one.
        // Walk up the DOM to find the nearest scrollable ancestor.
        let scrollParent: HTMLElement | null = firstError.parentElement;
        while (scrollParent && scrollParent !== document.body) {
            const { overflowY } = getComputedStyle(scrollParent);
            if (overflowY === 'auto' || overflowY === 'scroll') break;
            scrollParent = scrollParent.parentElement;
        }

        if (scrollParent && scrollParent !== document.body) {
            // Scroll the modal container so the error field lands near the top.
            const containerTop = scrollParent.getBoundingClientRect().top;
            const errorTop = firstError.getBoundingClientRect().top;
            scrollParent.scrollBy({ top: errorTop - containerTop - 24, behavior: 'smooth' });
        } else {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Focus the element if it's an input/select/textarea
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(firstError.tagName)) {
            firstError.focus({ preventScroll: true });
        }
    }, 50);
};

export const formatVehicleClass = (v: string | null | undefined): string => {
    if (!v) return '—';
    return v.replace(/_/g, ' ');
};
