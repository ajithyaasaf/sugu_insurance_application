export const POLICY_TYPES = ['motor', 'health', 'life', 'non_motor', 'other'];

export const MOTOR_VEHICLE_CLASSES = [
    'TW', 'PVT', 'PCV', 'GCV', 'SAOD_TW', 'SAOD_PVT', 'Misc_D', 'CPA', 'Others'
];

export const NON_MOTOR_VEHICLE_CLASSES = [
    'Fire', 'Public_Liability', 'CPM', 'Home_Insurance', 'RAK_Policy', 'Others'
];

export const VEHICLE_CLASSES = Array.from(
    new Set([...MOTOR_VEHICLE_CLASSES, ...NON_MOTOR_VEHICLE_CLASSES])
);
export const PREMIUM_MODES = ['monthly', 'quarterly', 'halfYearly', 'yearly', 'single'];

export const POLICY_STATUSES = ['active', 'expired', 'cancelled']; // expired is read-only (auto-calculated)
export const EDITABLE_POLICY_STATUSES = ['active', 'cancelled'];   // only these can be set manually
export const PAYMENT_STATUSES = ['pending', 'paid', 'partial'];
export const CLAIM_STATUSES = ['filed', 'approved', 'rejected', 'settled'];
export const FOLLOWUP_STATUSES = ['pending', 'completed', 'cancelled'];
export const LEAD_STATUSES = ['new', 'contacted', 'interested', 'converted', 'lost'];