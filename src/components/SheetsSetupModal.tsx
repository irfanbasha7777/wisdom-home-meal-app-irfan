import React, { useState } from 'react';
import { Check, Copy, ExternalLink, RefreshCw, RotateCcw, X } from 'lucide-react';
import { APPS_SCRIPT_CODE } from '../data/appsScriptCode';
import { AppSettings } from '../types';

interface SheetsSetupModalProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSaveSettings: (next: AppSettings) => void;
  onTestConnection: (url: string) => Promise<void>;
  onResetDemo: () => void;
}

export const SheetsSetupModal: React.FC<SheetsSetupModalProps> = ({
  open,
  settings,
  onClose,
  onSaveSettings,
  onTestConnection,
  onResetDemo,
}) => {
  const [urlInput, setUrlInput] = useState(settings.webAppUrl);
  const [demoMode, setDemoMode] = useState(settings.demoMode);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showCode, setShowCode] = useState(false);

  if (!open) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setStatusMsg({
        type: 'err',
        text: 'Clipboard blocked. Expand Code.gs below and copy manually.',
      });
      setShowCode(true);
    }
  };

  const handleTestAndSave = async () => {
    setStatusMsg(null);
    if (!demoMode && !urlInput.trim().startsWith('https://script.google.com/')) {
      setStatusMsg({
        type: 'err',
        text: 'Enter a valid Google Apps Script Web App URL starting with https://script.google.com/',
      });
      return;
    }

    if (demoMode) {
      onSaveSettings({ ...settings, webAppUrl: urlInput.trim(), demoMode: true });
      setStatusMsg({ type: 'ok', text: 'Demo / Offline Fallback Mode enabled.' });
      return;
    }

    setTesting(true);
    try {
      await onTestConnection(urlInput.trim());
      onSaveSettings({ ...settings, webAppUrl: urlInput.trim(), demoMode: false });
      setStatusMsg({
        type: 'ok',
        text: 'Connected! Your Google Sheet tabs (Residents, DailyMeals, LaundryStatus, Alerts, ActivityLog, Announcements) are live.',
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text:
          err instanceof Error
            ? `Connection failed: ${err.message}. Ensure Web App access is set to "Anyone".`
            : 'Unable to reach Google Apps Script URL.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Google Sheets Backend Setup"
    >
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#E0E3E7] shadow-xl">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-[#E0E3E7] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#202124]">
              Google Sheets Backend (₹0 Cost)
            </h2>
            <p className="text-xs text-[#5F6368]">
              Use Demo Mode for instant preview or connect your own Google Sheet Web App URL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5F6368] hover:bg-[#F1F3F4]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Demo / Fallback Toggle */}
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E0E3E7] flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#202124]">
                Demo / Offline Fallback Mode
              </div>
              <div className="text-xs text-[#5F6368]">
                Stores Wisdom Home JP Nagar test data locally in your browser when no Google Sheet is linked.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={demoMode}
              onClick={() => setDemoMode((d) => !d)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                demoMode ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                  demoMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Web App URL Form */}
          <div className="space-y-2">
            <label htmlFor="webapp-url" className="block text-sm font-medium text-[#202124]">
              Google Apps Script Web App URL
            </label>
            <input
              id="webapp-url"
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (e.target.value.trim().startsWith('https://script.google.com/')) {
                  setDemoMode(false);
                }
              }}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full min-h-[48px] px-4 rounded-xl border border-[#DADCE0] bg-white text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 font-mono"
            />
          </div>

          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl text-sm border ${
                statusMsg.type === 'ok'
                  ? 'bg-[#E6F4EA] border-[#A8DAB5] text-[#137333]'
                  : 'bg-[#FCE8E6] border-[#F6AEA9] text-[#A50E0E]'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTestAndSave}
              disabled={testing}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] disabled:opacity-60 text-white text-sm font-medium inline-flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {demoMode ? 'Save Demo Mode Setting' : testing ? 'Connecting...' : 'Test & Connect Sheet'}
            </button>
            <button
              type="button"
              onClick={() => {
                onResetDemo();
                setStatusMsg({ type: 'ok', text: 'Demo dataset reset to fresh defaults.' });
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#DADCE0] hover:bg-[#F8F9FA] text-[#202124] text-sm font-medium inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Demo Data
            </button>
          </div>

          {/* Step-by-Step 5-Minute Guide */}
          <div className="border-t border-[#E0E3E7] pt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#202124]">
                5-Minute Setup: Copy Code.gs into Google Sheets
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#DADCE0] hover:bg-[#F8F9FA] text-xs font-medium text-[#1A73E8] inline-flex items-center gap-1.5"
                >
                  Open sheets.new
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#E8F0FE] hover:bg-[#D2E3FC] text-xs font-medium text-[#174EA6] inline-flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied Code.gs' : 'Copy Code.gs'}
                </button>
              </div>
            </div>

            <ol className="space-y-2 text-xs text-[#5F6368] list-decimal pl-5 leading-relaxed">
              <li>
                Open <span className="font-medium text-[#202124]">sheets.new</span> and name your spreadsheet <span className="font-medium text-[#202124]">Wisdom Home JP Nagar Database</span>.
              </li>
              <li>
                Click <span className="font-medium text-[#202124]">Extensions → Apps Script</span>, delete any placeholder code, and paste <span className="font-medium text-[#202124]">Code.gs</span>.
              </li>
              <li>
                Click <span className="font-medium text-[#202124]">Save</span>, then <span className="font-medium text-[#202124]">Deploy → New deployment → Web app</span>.
              </li>
              <li>
                Set <span className="font-medium text-[#202124]">Execute as: Me</span> and <span className="font-medium text-[#202124]">Who has access: Anyone</span>, then authorize and deploy.
              </li>
              <li>
                Copy the generated <span className="font-medium text-[#202124]">Web App URL</span>, paste it above, and click <span className="font-medium text-[#202124]">Test & Connect Sheet</span>. Tabs auto-create on first sync.
              </li>
            </ol>

            <div>
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="text-xs font-medium text-[#1A73E8] hover:underline"
              >
                {showCode ? 'Hide Code.gs source' : 'Preview Code.gs source'}
              </button>
              {showCode && (
                <pre className="mt-2 p-3.5 rounded-xl bg-[#202124] text-[#E8EAED] text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed">
                  {APPS_SCRIPT_CODE}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
