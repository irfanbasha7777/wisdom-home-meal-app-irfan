import React from 'react';
import { Bell, Megaphone, Newspaper, Utensils, WashingMachine, X } from 'lucide-react';
import { PGAlert } from '../types';

interface AlertBannersProps {
  alerts: PGAlert[];
  residentMobile: string;
  onDismiss: (alertId: string) => void;
}

export const AlertBanners: React.FC<AlertBannersProps> = ({
  alerts,
  residentMobile,
  onDismiss,
}) => {
  const visible = alerts.filter((a) => {
    const forMe = a.targetMobile === 'ALL' || a.targetMobile === residentMobile;
    const dismissed = a.dismissedBy.includes(residentMobile);
    return forMe && !dismissed;
  });

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2.5 mb-5">
      {visible.slice(0, 3).map((alert) => {
        const isClothes = alert.type === 'CLOTHES_READY';
        const isExtraFood = alert.type === 'EXTRA_FOOD';
        const isAnnouncement = alert.type === 'ANNOUNCEMENT';
        const isAdminPush = alert.type === 'ADMIN_PUSH';

        const style = isClothes
          ? 'bg-[#FEF7E0] border-[#F9AB00]/40 text-[#7A4100]'
          : isExtraFood
          ? 'bg-[#E6F4EA] border-[#1E8E3E]/30 text-[#0D652D]'
          : isAdminPush
          ? 'bg-[#FCE8E6] border-[#D93025]/30 text-[#A50E0E]'
          : 'bg-[#E8F0FE] border-[#1A73E8]/30 text-[#174EA6]';

        const Icon = isClothes
          ? WashingMachine
          : isExtraFood
          ? Utensils
          : isAnnouncement
          ? Newspaper
          : isAdminPush
          ? Megaphone
          : Bell;

        return (
          <div
            key={alert.id}
            className={`flex items-start justify-between gap-3 px-4 py-3.5 rounded-2xl border ${style}`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{alert.title}</div>
                <p className="text-xs sm:text-sm opacity-95 mt-0.5 leading-snug">
                  {alert.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              aria-label="Dismiss notification"
              className="min-h-[36px] min-w-[36px] shrink-0 flex items-center justify-center rounded-xl hover:bg-black/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
