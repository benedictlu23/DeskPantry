import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, MapPin, X } from 'lucide-react';
import { UserAccount } from '../types';

interface WorkstationSetupModalProps {
  isOpen: boolean;
  isDark: boolean;
  currentUser: UserAccount;
  isFirstTimeSetup: boolean;
  onClose: () => void;
  onSave: (workstation: {
    department: string;
    tableRow: string;
    tableNumber: string;
  }) => Promise<void> | void;
}

const SUGGESTED_DEPARTMENTS = [
  'Engineering Ops',
  'Customer Support',
  'Finance & Payroll',
  'HR & Talent',
  'Sales & Growth',
  'Marketing',
  'Operations',
  'Product & Design',
];

export const WorkstationSetupModal: React.FC<WorkstationSetupModalProps> = ({
  isOpen,
  isDark,
  currentUser,
  isFirstTimeSetup,
  onClose,
  onSave,
}) => {
  const initialDept =
    currentUser.department &&
    currentUser.department !== 'Department Staff' &&
    currentUser.department !== 'Unassigned'
      ? currentUser.department
      : '';
  const [department, setDepartment] = useState(initialDept);
  const [tableRow, setTableRow] = useState(currentUser.tableRow || '');
  const [tableNumber, setTableNumber] = useState(currentUser.tableNumber || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const cleanDept =
      currentUser.department &&
      currentUser.department !== 'Department Staff' &&
      currentUser.department !== 'Unassigned'
        ? currentUser.department
        : '';
    setDepartment(cleanDept);
    setTableRow(currentUser.tableRow || '');
    setTableNumber(currentUser.tableNumber || '');
    setError('');
  }, [isOpen, currentUser.id, currentUser.department, currentUser.tableRow, currentUser.tableNumber]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDept = department.trim();
    const cleanRow = tableRow.trim();
    const cleanTable = tableNumber.trim();
    if (!cleanDept || !cleanRow || !cleanTable) {
      setError('Please enter your Department Name, Table Row, and Table Number.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({
        department: cleanDept,
        tableRow: cleanRow,
        tableNumber: cleanTable,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your workstation details. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workstation-setup-title"
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-[#121D1B] border-[#1E322E] text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div
          className={`flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b ${
            isDark ? 'border-[#1E322E]' : 'border-slate-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 id="workstation-setup-title" className="text-base font-bold">
                {isFirstTimeSetup
                  ? 'Set Your Department & Desk Location'
                  : 'Update Department & Desk Location'}
              </h2>
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {isFirstTimeSetup
                  ? 'Save this once so your Storefront and Community orders auto-fill your department, row, and table number.'
                  : 'Changes automatically pre-fill future Storefront and Community purchases.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
            aria-label="Close workstation setup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="ws-department"
              className={`block text-xs font-semibold mb-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Department Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="ws-department"
                type="text"
                maxLength={120}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering Ops, Finance, Support"
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  isDark
                    ? 'bg-[#0C1412] border-[#1E322E] text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_DEPARTMENTS.slice(0, 5).map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDepartment(dept)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
                    department.trim() === dept
                      ? 'bg-teal-600 text-white border-teal-600'
                      : isDark
                      ? 'bg-[#0C1412] border-[#1E322E] text-slate-300 hover:border-teal-600/60'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-teal-500'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ws-table-row"
                className={`block text-xs font-semibold mb-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Table Row
              </label>
              <input
                id="ws-table-row"
                type="text"
                maxLength={40}
                value={tableRow}
                onChange={(e) => setTableRow(e.target.value)}
                placeholder="e.g. Row B / 2nd Floor"
                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  isDark
                    ? 'bg-[#0C1412] border-[#1E322E] text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
            <div>
              <label
                htmlFor="ws-table-number"
                className={`block text-xs font-semibold mb-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Table Number
              </label>
              <input
                id="ws-table-number"
                type="text"
                maxLength={40}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. T-14 or Desk 08"
                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  isDark
                    ? 'bg-[#0C1412] border-[#1E322E] text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-3 py-2 text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-500">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                isDark
                  ? 'border-[#1E322E] text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isFirstTimeSetup ? 'Remind Me Later' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Department & Desk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
