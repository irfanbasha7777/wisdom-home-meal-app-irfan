import React, { useState } from 'react';
import { Lock, Shield, X } from 'lucide-react';

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticate: (username: string, passcode: string) => Promise<void>;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  open,
  onClose,
  onAuthenticate,
}) => {
  const [username, setUsername] = useState('admin');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !passcode.trim()) {
      setError('Enter both staff username and passcode.');
      return;
    }
    setLoading(true);
    try {
      await onAuthenticate(username.trim(), passcode.trim());
      setPasscode('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid Admin or Warden credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Admin and Warden Login"
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[#E0E3E7] p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#202124]">
                Admin &amp; Warden Sign In
              </h2>
              <p className="text-xs text-[#5F6368]">
                Restricted portal for Wisdom Home JP Nagar management.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#5F6368] hover:bg-[#F1F3F4]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-user" className="block text-xs font-medium text-[#202124] mb-1.5">
              Staff Role / Username
            </label>
            <select
              id="admin-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full min-h-[46px] px-3.5 rounded-xl border border-[#DADCE0] bg-white text-sm text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            >
              <option value="admin">Admin (Kitchen &amp; Management)</option>
              <option value="warden">Warden (Floor &amp; Resident Ops)</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-pass" className="block text-xs font-medium text-[#202124] mb-1.5">
              Admin Passcode
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#5F6368] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="admin-pass"
                type="password"
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-[#DADCE0] bg-white text-sm text-[#202124] focus:outline-none focus:border-[#1A73E8]"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[#FCE8E6] border border-[#F6AEA9] text-xs text-[#A50E0E]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] disabled:opacity-60 text-white text-sm font-medium transition-colors"
          >
            {loading ? 'Verifying...' : 'Unlock Admin & Warden Portal'}
          </button>
        </form>
      </div>
    </div>
  );
};
