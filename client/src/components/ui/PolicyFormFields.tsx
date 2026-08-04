import React from 'react';
import SearchableSelect from './SearchableSelect';
import { POLICY_TYPES, VEHICLE_CLASSES, MOTOR_VEHICLE_CLASSES, NON_MOTOR_VEHICLE_CLASSES, PREMIUM_MODES } from '../../utils/constants';
import { formatDateInput, formatVehicleClass } from '../../utils/format';

interface PolicyFormFieldsProps {
    form: any;
    setForm: (val: any | ((prev: any) => any)) => void;
    companies: any[];
    dealers: any[];
    customers?: any[];
    isEditing?: boolean;
    showQuoteHeader?: boolean;
    isRenewal?: boolean;
    parentHadClaim?: boolean;
    errors?: Record<string, string>;
    setErrors?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const PolicyFormFields: React.FC<PolicyFormFieldsProps> = ({ form, setForm, companies = [], dealers = [], customers = [], isEditing = false, showQuoteHeader = false, isRenewal = false, parentHadClaim = false, errors = {}, setErrors }) => {
    const isMotor = form.policyType === 'motor';
    const isNonMotor = form.policyType === 'non_motor';
    const isRequired = !showQuoteHeader;

    const dateError = form.expiryDate && form.startDate && form.expiryDate <= form.startDate
        ? 'Expiry date must be after start date'
        : '';

    const handleChange = (field: string, value: any) => {
        if (typeof setForm === 'function') {
            setForm((prev: any) => {
                const updated = { ...prev, [field]: value };
                
                // --- Smart Auto-Calculation Logic ---
                if (field === 'od' || field === 'tp' || field === 'tax' || field === 'premiumAmount') {
                    const od = parseFloat(field === 'od' ? value : prev.od) || 0;
                    const tp = parseFloat(field === 'tp' ? value : prev.tp) || 0;
                    const tax = parseFloat(field === 'tax' ? value : prev.tax) || 0;
                    
                    // 1. Calculate Net Premium (OD + TP) if either OD or TP was the trigger
                    if (field === 'od' || field === 'tp') {
                        updated.premiumAmount = (od + tp).toString();
                    }
                    
                    // 2. Calculate Total Premium (Net + Tax) if any part changed
                    const net = parseFloat(updated.premiumAmount || prev.premiumAmount) || 0;
                    if (field === 'od' || field === 'tp' || field === 'tax' || field === 'premiumAmount') {
                        updated.totalPremium = (net + tax).toString();
                    }
                }
                
                return updated;
            });
        }
        if (typeof setErrors === 'function') {
            setErrors((prev: any) => ({ ...prev, [field]: '' }));
        }
    };

    const handleTypeChange = (val: string) => {
        setForm((prev: any) => ({
            ...prev,
            policyType: val,
            ...(val === 'health' || val === 'life' || val === 'non_motor' ? {
                vehicleNumber: '', make: '', model: '', registrationDate: '',
                idv: '', od: '', tp: '', tax: '', totalPremium: '', premiumAmount: ''
            } : val === 'other' ? {
                vehicleNumber: '', make: '', model: '', vehicleClass: '',
                idv: '', registrationDate: '',
                productName: '',
                sumInsured: ''
            } : {
                productName: '',
                sumInsured: ''
            })
        }));
        if (typeof setErrors === 'function') {
            setErrors((prev: any) => ({ ...prev, policyType: '' }));
        }
    };

    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${showQuoteHeader ? 'border-t border-surface-200 pt-4 mt-4' : ''}`}>
            {showQuoteHeader && (
                <div className="col-span-full">
                    <h3 className="font-semibold text-surface-900">Quote / Draft Details (Optional)</h3>
                    <p className="text-xs text-surface-500">Fill these out to auto-generate a policy upon conversion.</p>
                </div>
            )}
            
            {customers && customers.length > 0 && (
                <div>
                    <label className="label">Customer *</label>
                    <SearchableSelect
                        options={customers.map(c => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }))}
                        value={form.customerId || ''}
                        onChange={(val) => handleChange('customerId', val)}
                        placeholder="Select Customer"
                        hasError={!!errors.customerId}
                    />
                    {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
                </div>
            )}

            <div>
                <label className="label">Policy Type {isRequired ? '*' : ''}</label>
                <SearchableSelect
                    disabled={isEditing || isRenewal}
                    options={POLICY_TYPES.map(t => ({ value: t, label: t === 'non_motor' ? 'Non Motor' : t.charAt(0).toUpperCase() + t.slice(1) }))}
                    value={form.policyType || ''}
                    onChange={handleTypeChange}
                    placeholder="Select Type"
                    hasError={!!errors.policyType}
                />
                {errors.policyType && <p className="text-xs text-red-500 mt-1">{errors.policyType}</p>}
            </div>

            {!isRenewal && (
                <div>
                    <label className="label">Policy Origin {isRequired ? '*' : ''}</label>
                    <SearchableSelect
                        options={[
                            { value: 'new_vehicle', label: 'New Vehicle (First-time insurance)' },
                            { value: 'fresh', label: 'Fresh (No prior policy / Port-in)' },
                            { value: 'external_renewal', label: 'External Renewal (From another insurer)' },
                            { value: 'in_system_renewal', label: 'Own Renewal (Manual re-entry)' },
                        ]}
                        value={form.policyOrigin || 'fresh'}
                        onChange={(val) => {
                            // When switching to new_vehicle or fresh, zero-out NCB automatically
                            const noNcbOrigins = ['new_vehicle', 'fresh'];
                            setForm((prev: any) => ({
                                ...prev,
                                policyOrigin: val,
                                ...(noNcbOrigins.includes(val) ? { ncbPercentage: null } : {}),
                            }));
                            if (typeof setErrors === 'function') {
                                setErrors((prev: any) => ({ ...prev, policyOrigin: '' }));
                            }
                        }}
                        placeholder="Select Origin"
                        hasError={!!errors.policyOrigin}
                    />
                    {form.policyOrigin === 'new_vehicle' && (
                        <p className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                            ℹ️ New vehicles have no NCB history — NCB is automatically set to 0%.
                        </p>
                    )}
                    {form.policyOrigin === 'in_system_renewal' && (
                        <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                            ⚠️ Use this only for manual re-entry of existing customer policies. Use the Renew button on a policy for in-system renewals.
                        </p>
                    )}
                </div>
            )}

            {/* NCB Field: shown only for external_renewal and in_system_renewal, hidden for new_vehicle and fresh */}
            {isMotor && (form.policyOrigin === 'external_renewal' || form.policyOrigin === 'in_system_renewal') && (
                <div>
                    <label className="label">
                        {form.policyOrigin === 'external_renewal' ? 'Prior NCB (from previous insurer) %' : 'NCB Applied %'}
                    </label>
                    <SearchableSelect
                        options={[
                            { value: '0', label: 'None (0%)' },
                            { value: '20', label: '20%' },
                            { value: '25', label: '25%' },
                            { value: '35', label: '35%' },
                            { value: '45', label: '45%' },
                            { value: '50', label: '50%' },
                        ]}
                        value={form.ncbPercentage !== null && form.ncbPercentage !== undefined ? form.ncbPercentage.toString() : ''}
                        onChange={(val) => handleChange('ncbPercentage', val ? Number(val) : null)}
                        allLabel="Leave blank / N/A"
                        hasError={!!errors.ncbPercentage}
                    />
                    {isRenewal && parentHadClaim && (
                        <p className="text-xs text-amber-600 mt-1 font-medium bg-amber-50 p-1.5 rounded border border-amber-200">
                            ⚠️ Parent policy had a claim. NCB is not applicable — enter 0% or leave blank.
                        </p>
                    )}
                </div>
            )}

            <div>
                <label className="label">Company {isRequired ? '*' : ''}</label>
                <SearchableSelect
                    options={companies
                        .filter(c => {
                            if (form.policyType === 'life') return c.name === 'LIC';
                            if (form.policyType === 'health') return ['Star Health Insurance', 'New India Assurance', 'Care Insurance'].includes(c.name);
                            if (form.policyType === 'motor') return !['Star Health Insurance', 'Care Insurance', 'LIC'].includes(c.name);
                            return true;
                        })
                        .map(c => ({ value: c?.id, label: c?.name }))
                    }
                    value={form.companyId || ''}
                    onChange={(val) => handleChange('companyId', val)}
                    allLabel="None"
                    hasError={!!errors.companyId}
                />
                {errors.companyId && <p className="text-xs text-red-500 mt-1">{errors.companyId}</p>}
            </div>

            <div>
                <label className="label">Policy Number {isRequired ? '*' : ''}</label>
                <input 
                    className={`input ${errors.policyNumber ? 'border-red-500 focus:ring-red-400' : ''}`}
                    data-error-field={errors.policyNumber ? 'true' : undefined}
                    value={form.policyNumber || ''} 
                    onChange={(e) => handleChange('policyNumber', e.target.value)} 
                    placeholder="Enter Policy Number"
                />
                {errors.policyNumber && <p className="text-xs text-red-500 mt-1">{errors.policyNumber}</p>}
            </div>

            <div>
                <label className="label">Dealer</label>
                <SearchableSelect
                    options={dealers?.map(d => ({ value: d?.id, label: d?.name })) || []}
                    value={form.dealerId || ''}
                    onChange={(val) => handleChange('dealerId', val)}
                    allLabel="No Dealer"
                    hasError={!!errors.dealerId}
                />
            </div>

            {form.policyType && form.policyType !== 'motor' && (
                <div>
                    <label className="label">Product Name</label>
                    <input 
                        className="input" 
                        value={form.productName || ''} 
                        onChange={(e) => handleChange('productName', e.target.value)} 
                        placeholder="e.g. Health Guard"
                    />
                </div>
            )}

            {isNonMotor && (
                <div>
                    <label className="label">Vehicle Class</label>
                    <SearchableSelect
                        options={NON_MOTOR_VEHICLE_CLASSES.map(c => ({ value: c, label: formatVehicleClass(c) }))}
                        value={form.vehicleClass || ''}
                        onChange={(val) => handleChange('vehicleClass', val)}
                        allLabel="Select Class"
                        hasError={!!errors.vehicleClass}
                    />
                </div>
            )}

            {isMotor && (
                <>
                    <div><label className="label">Vehicle Number {isRequired ? '*' : ''}</label>
                        <input
                            className={`input uppercase ${errors.vehicleNumber ? 'border-red-500 focus:ring-red-400' : ''}`}
                            data-error-field={errors.vehicleNumber ? 'true' : undefined}
                            placeholder="e.g. TN01AB1234"
                            title="Enter a valid vehicle registration number"
                            value={form.vehicleNumber || ''}
                            onChange={(e) => handleChange('vehicleNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                        />
                        {errors.vehicleNumber && <p className="text-xs text-red-500 mt-1">{errors.vehicleNumber}</p>}
                    </div>
                    <div><label className="label">Make {isRequired ? '*' : ''}</label>
                        <input className={`input ${errors.make ? 'border-red-500 focus:ring-red-400' : ''}`} data-error-field={errors.make ? 'true' : undefined} placeholder="e.g. Maruti" value={form.make || ''} onChange={(e) => handleChange('make', e.target.value)} />
                        {errors.make && <p className="text-xs text-red-500 mt-1">{errors.make}</p>}
                    </div>
                    <div><label className="label">Model {isRequired ? '*' : ''}</label>
                        <input className={`input ${errors.model ? 'border-red-500 focus:ring-red-400' : ''}`} data-error-field={errors.model ? 'true' : undefined} placeholder="e.g. Swift" value={form.model || ''} onChange={(e) => handleChange('model', e.target.value)} />
                        {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
                    </div>
                    <div><label className="label">Date of Registration</label>
                        <input type="date" className="input" value={form.registrationDate?.split('T')[0] || ''} onChange={(e) => handleChange('registrationDate', e.target.value)} />
                    </div>
                    <div><label className="label">Vehicle Class</label>
                        <SearchableSelect
                            options={MOTOR_VEHICLE_CLASSES.map(c => ({ value: c, label: formatVehicleClass(c) }))}
                            value={form.vehicleClass || ''}
                            onChange={(val) => handleChange('vehicleClass', val)}
                            allLabel="Select Class"
                            hasError={!!errors.vehicleClass}
                        />
                    </div>
                    <div><label className="label">IDV</label>
                        <input type="number" min="0" step="0.01" className="input" value={form.idv || ''} onChange={(e) => handleChange('idv', e.target.value)} />
                    </div>
                </>
            )}

            {(isMotor || form.policyType === 'other') && (
                <>
                    <div><label className="label">OD Premium</label>
                        <input type="number" min="0" step="0.01" className="input" value={form.od || ''} onChange={(e) => handleChange('od', e.target.value)} />
                    </div>
                    <div><label className="label">TP Premium</label>
                        <input type="number" min="0" step="0.01" className="input" value={form.tp || ''} onChange={(e) => handleChange('tp', e.target.value)} />
                    </div>
                </>
            )}

            {(isMotor || form.policyType === 'other' || isNonMotor) && (
                <div><label className="label">Tax (GST)</label>
                    <input type="number" min="0" step="0.01" className="input" value={form.tax || ''} onChange={(e) => handleChange('tax', e.target.value)} />
                </div>
            )}

            {(form.policyType === 'health' || form.policyType === 'life' || form.policyType === 'non_motor' || form.policyType === 'other') && (
                <div>
                    <label className="label">Sum Insured</label>
                    <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        className="input" 
                        value={form.sumInsured || ''} 
                        onChange={(e) => handleChange('sumInsured', e.target.value)} 
                    />
                </div>
            )}

            <div><label className="label">{isMotor || form.policyType === 'other' ? 'Net Premium (OD + TP)' : 'Net Premium'} {isRequired ? '*' : ''}</label>
                <input type="number" min="0" step="0.01" className={`input ${errors.premiumAmount ? 'border-red-500 focus:ring-red-400' : ''}`} data-error-field={errors.premiumAmount ? 'true' : undefined} value={form.premiumAmount || ''} onChange={(e) => handleChange('premiumAmount', e.target.value)} />
                {errors.premiumAmount && <p className="text-xs text-red-500 mt-1">{errors.premiumAmount}</p>}
            </div>

            <div><label className="label">Total Premium (Net + Tax) {isRequired ? '*' : ''}</label>
                <input type="number" min="0" step="0.01" className={`input ${errors.totalPremium ? 'border-red-500 focus:ring-red-400' : ''}`} data-error-field={errors.totalPremium ? 'true' : undefined} value={form.totalPremium || ''} onChange={(e) => handleChange('totalPremium', e.target.value)} />
                {errors.totalPremium && <p className="text-xs text-red-500 mt-1">{errors.totalPremium}</p>}
            </div>
            
            {(() => {
                const isSaod = form.vehicleClass === 'SAOD_TW' || form.vehicleClass === 'SAOD_PVT';
                return (
                    <>
                        <div>
                            <label className="label">
                                {isSaod ? 'OD Start Date' : 'Start Date'} {isRequired ? '*' : ''}
                            </label>
                            <input
                                type="date"
                                className={`input ${errors.startDate ? 'border-red-500 focus:ring-red-400' : ''}`}
                                data-error-field={errors.startDate ? 'true' : undefined}
                                value={form.startDate?.split('T')[0] || ''}
                                onChange={(e) => handleChange('startDate', e.target.value)}
                            />
                            {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
                        </div>

                        <div>
                            <label className="label">
                                {isSaod ? 'OD End Date' : 'Expiry Date'} {isRequired ? '*' : ''}
                            </label>
                            <input
                                type="date"
                                className={`input ${dateError || errors.expiryDate ? 'border-red-500 focus:ring-red-400' : ''}`}
                                data-error-field={(dateError || errors.expiryDate) ? 'true' : undefined}
                                min={form.startDate || undefined}
                                value={form.expiryDate?.split('T')[0] || ''}
                                onChange={(e) => handleChange('expiryDate', e.target.value)}
                            />
                            {(dateError || errors.expiryDate) && <p className="text-xs text-red-500 mt-1">{dateError || errors.expiryDate}</p>}
                        </div>

                        {isSaod && (
                            <>
                                <div>
                                    <label className="label">TP Start Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={form.tpStartDate?.split('T')[0] || ''}
                                        onChange={(e) => handleChange('tpStartDate', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label">TP End Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={form.tpEndDate?.split('T')[0] || ''}
                                        onChange={(e) => handleChange('tpEndDate', e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                    </>
                );
            })()}

            <div><label className="label">Payment Method</label>
                <SearchableSelect
                    options={['Cash', 'UPI', 'Cheque', 'Online', 'NEFT', 'APD'].map(m => ({ value: m, label: m }))}
                    value={form.paymentMethod || ''}
                    onChange={(val) => handleChange('paymentMethod', val)}
                    placeholder="Select Method"
                    hasError={!!errors.paymentMethod}
                />
            </div>

            {!isEditing && (
                <div>
                    <label className="label">Initial Paid Amount (₹)</label>
                    <input 
                        type="number" 
                        min="0" 
                        max={parseFloat(form.totalPremium || form.premiumAmount) || 0} 
                        step="0.01" 
                        className="input" 
                        placeholder="Leave empty if pending"
                        value={form.paidAmount || ''} 
                        onChange={(e) => handleChange('paidAmount', e.target.value)} 
                    />
                </div>
            )}

        </div>
    );
};

export default PolicyFormFields;