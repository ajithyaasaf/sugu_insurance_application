import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineExclamation, HiOutlineX, HiOutlineArrowRight } from 'react-icons/hi';
import api from '../../api/client';

interface ExpiringPolicy {
    id: string;
    policyNumber: string;
    vehicleNumber: string;
    expiryDate: string;
    tpEndDate?: string | null;
    daysRemaining: number;
    isTpExpiringSoon?: boolean;
    customer: {
        name: string;
    };
    company?: {
        name: string;
    };
}

const ExpiringBanner: React.FC = () => {
    const [policies, setPolicies] = useState<ExpiringPolicy[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fade, setFade] = useState(true);
    const [visible, setVisible] = useState(false);
    const navigate = useNavigate();

    const getDaysRemaining = (expiryDateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(expiryDateStr);
        expiry.setHours(0, 0, 0, 0);
        const diff = expiry.getTime() - today.getTime();
        return Math.round(diff / (1000 * 60 * 60 * 24));
    };

    useEffect(() => {
        const fetchExpiringPolicies = async () => {
            try {
                const res = await api.get('/policies', {
                    params: {
                        expiringSoon: true,
                        limit: 30
                    }
                });

                if (res.data && res.data.data) {
                    const mapped: ExpiringPolicy[] = res.data.data
                        .map((p: any) => {
                            const odDays = getDaysRemaining(p.expiryDate);
                            const tpDays = p.tpEndDate ? getDaysRemaining(p.tpEndDate) : 9999;
                            const isTpUrgent = tpDays < odDays;
                            return { 
                                ...p, 
                                daysRemaining: isTpUrgent ? tpDays : odDays,
                                isTpExpiringSoon: isTpUrgent
                            };
                        })
                        .filter((p: any) => p.daysRemaining >= 0 && p.daysRemaining <= 7)
                        // Sort by urgency: today first, then tomorrow, then upcoming
                        .sort((a: ExpiringPolicy, b: ExpiringPolicy) => a.daysRemaining - b.daysRemaining);

                    setPolicies(mapped);
                    if (mapped.length > 0) {
                        setVisible(true);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch expiring policies for banner', err);
            }
        };

        fetchExpiringPolicies();
    }, []);

    // Cycle through policies if multiple exist
    useEffect(() => {
        if (policies.length <= 1 || !visible) return;

        const interval = setInterval(() => {
            setFade(false);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % policies.length);
                setFade(true);
            }, 300); // Matches the CSS transition time
        }, 6000);

        return () => clearInterval(interval);
    }, [policies, visible]);

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        setVisible(false);
    };

    const handleAction = (policyId: string) => {
        navigate(`/policies/${policyId}`);
    };

    if (!visible || policies.length === 0) return null;

    const current = policies[currentIndex];
    
    // Choose banner styles dynamically based on urgency
    let bannerStyle = "from-amber-500 to-orange-500"; // 2-7 days
    let label = "RENEWAL DUE";
    let iconAnimation = "animate-bounce";

    if (current.daysRemaining === 0) {
        bannerStyle = "from-red-600 via-orange-600 to-red-700 animate-pulse";
        label = "CRITICAL: EXPIRING TODAY";
        iconAnimation = "animate-ping";
    } else if (current.daysRemaining === 1) {
        bannerStyle = "from-orange-500 via-amber-500 to-orange-600";
        label = "URGENT: EXPIRING TOMORROW";
        iconAnimation = "animate-pulse";
    }

    return (
        <div className={`relative bg-gradient-to-r ${bannerStyle} text-white px-4 py-2 text-sm shadow-md transition-all duration-300 flex items-center justify-between border-b border-white/10 z-30`}>
            {/* Left Content Container */}
            <div className={`flex items-center gap-3 transition-opacity duration-300 flex-1 min-w-0 ${fade ? 'opacity-100' : 'opacity-0'}`}>
                {/* Alert Icon with dynamic pulse */}
                <div className="relative flex h-5 w-5 items-center justify-center flex-shrink-0">
                    <span className={`absolute inline-flex h-full w-full rounded-full bg-white opacity-20 ${iconAnimation}`}></span>
                    <HiOutlineExclamation className="relative h-4 w-4 text-white" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm flex-shrink-0">
                        {label}
                    </span>
                    <p className="truncate font-medium text-xs sm:text-sm">
                        {current.isTpExpiringSoon ? 'TP Cover' : 'OD Cover'} for Policy <span className="font-mono bg-black/10 px-1 py-0.5 rounded">{current.policyNumber}</span> for <span className="font-bold">{current.customer?.name}</span> 
                        {current.vehicleNumber && current.vehicleNumber !== '—' && ` (${current.vehicleNumber})`} 
                        {current.daysRemaining === 0 ? " expires today!" : current.daysRemaining === 1 ? " expires tomorrow!" : ` expires in ${current.daysRemaining} days.`}
                    </p>
                </div>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <button
                    onClick={() => handleAction(current.id)}
                    className="inline-flex items-center gap-1 bg-white text-orange-600 hover:bg-orange-50 active:bg-orange-100 font-semibold px-3 py-1 rounded-lg text-xs shadow-sm transition-all duration-200"
                >
                    Renew Policy
                    <HiOutlineArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={handleDismiss}
                    className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
                    aria-label="Dismiss alert"
                >
                    <HiOutlineX className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default ExpiringBanner;
