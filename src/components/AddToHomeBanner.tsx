import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISS_KEY = 'wisdom_a2hs_dismissed_v1';

export const AddToHomeBanner: React.FC = () => {
  const { canPromptNative, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const handleAction = async () => {
    if (canPromptNative) {
      const ok = await install();
      if (ok) handleDismiss();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <div className="mb-4 rounded-2xl bg-[#E8F0FE] border border-[#1A73E8]/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#1A73E8] text-white flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#174EA6]">
              Add Wisdom Home JP Nagar to your Home Screen
            </div>
            <div className="text-xs text-[#174EA6]/85">
              Install for 1-tap meal passes, live laundry alerts, and faster check-in.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAction}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {canPromptNative ? 'Add to Home Screen' : 'How to Install'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install notification"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#174EA6] hover:bg-[#D2E3FC] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add to Home Screen Instructions"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[#E0E3E7] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#202124]">
                Add Wisdom Home to Home Screen
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#5F6368] hover:bg-[#F1F3F4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-sm text-[#5F6368] space-y-2 list-decimal pl-5 leading-relaxed">
                <li>
                  Tap the <span className="font-semibold text-[#202124]">Share</span> icon in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap <span className="font-semibold text-[#202124]">Add to Home Screen</span>.
                </li>
                <li>
                  Tap <span className="font-semibold text-[#202124]">Add</span> in the top right corner.
                </li>
              </ol>
            ) : (
              <ol className="text-sm text-[#5F6368] space-y-2 list-decimal pl-5 leading-relaxed">
                <li>
                  Open your browser menu (<span className="font-semibold text-[#202124]">⋮</span> in Chrome/Edge).
                </li>
                <li>
                  Tap <span className="font-semibold text-[#202124]">Add to Home screen</span> or <span className="font-semibold text-[#202124]">Install app</span>.
                </li>
                <li>
                  Confirm to pin <span className="font-semibold text-[#202124]">Wisdom Home</span> on your phone.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => {
                setShowGuide(false);
                handleDismiss();
              }}
              className="w-full min-h-[44px] rounded-xl bg-[#1A73E8] text-white text-sm font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
