import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface QuickCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCustomerCreated: (customer: any) => void;
}

export const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({
    isOpen,
    onClose,
    onCustomerCreated,
}) => {
    const [form, setForm] = useState({
        name: '',
        phone: '',
        email: '',
        dob: '',
        address: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setForm({ name: '', phone: '', email: '', dob: '', address: '' });
            setErrors({});
            setDuplicateWarning(null);
            setSubmitting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        const checkDuplicateCustomer = async () => {
            if (form.name.trim() && form.phone.length === 10) {
                try {
                    const res = await api.get('/customers/check-duplicate', {
                        params: {
                            name: form.name.trim(),
                            phone: form.phone,
                        },
                    });
                    if (res.data?.data?.exists) {
                        setDuplicateWarning(`⚠️ Note: A customer named "${form.name.trim()}" with phone ${form.phone} already exists.`);
                    } else {
                        setDuplicateWarning(null);
                    }
                } catch {
                    setDuplicateWarning(null);
                }
            } else {
                setDuplicateWarning(null);
            }
        };

        const timer = setTimeout(checkDuplicateCustomer, 500);
        return () => clearTimeout(timer);
    }, [form.name, form.phone]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = 'Name is required';
        if (!form.phone) errs.phone = 'Phone number is required';
        else if (!/^[0-9]{10}$/.test(form.phone)) errs.phone = 'Enter a valid 10-digit phone number';
        return errs;
    };

    const handleSubmit = async (e?: React.SyntheticEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        setErrors({});
        setSubmitting(true);
        try {
            const res = await api.post('/customers', form);
            const createdCustomer = res.data?.data;
            toast.success('Customer created successfully');
            onCustomerCreated(createdCustomer);
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create customer');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Customer" size="md">
            <div
                className="space-y-4"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSubmit(e);
                    }
                }}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Name *</label>
                        <input
                            className={`input ${errors.name ? 'border-red-500 focus:ring-red-400' : ''}`}
                            placeholder="Enter customer name"
                            value={form.name}
                            onChange={(e) => {
                                setForm({ ...form, name: e.target.value });
                                setErrors((prev) => ({ ...prev, name: '' }));
                            }}
                            disabled={submitting}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="label">Phone *</label>
                        <input
                            type="tel"
                            className={`input ${errors.phone ? 'border-red-500 focus:ring-red-400' : ''}`}
                            placeholder="9876543210"
                            value={form.phone}
                            onChange={(e) => {
                                setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) });
                                setErrors((prev) => ({ ...prev, phone: '' }));
                            }}
                            disabled={submitting}
                        />
                        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                    </div>
                    <div className="sm:col-span-2">
                        <label className="label">Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="example@email.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            disabled={submitting}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="label">Date of Birth</label>
                        <input
                            type="date"
                            className="input"
                            value={form.dob}
                            onChange={(e) => setForm({ ...form, dob: e.target.value })}
                            disabled={submitting}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="label">Address</label>
                        <textarea
                            className="input"
                            rows={2}
                            placeholder="Enter full address..."
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            disabled={submitting}
                        />
                    </div>
                </div>

                {duplicateWarning && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                        {duplicateWarning}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary flex-1">
                        Cancel
                    </button>
                    <Button type="button" onClick={handleSubmit} isLoading={submitting} className="btn-primary flex-1">
                        Save Customer
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default QuickCustomerModal;
