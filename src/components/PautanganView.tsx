import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Lock,
  Upload,
  X,
} from 'lucide-react';
import { SAMPLE_RECEIPT_DATA_URL } from '../data/seedData';
import {
  LoanRecord,
  PautanganSettings,
  PaymentMethodConfig,
  UserAccount,
  UserRole,
} from '../types';
import { formatPHP } from '../utils/format';
import { PaymentMethodCard } from './PaymentMethodCard';

interface PautanganViewProps {
  settings: PautanganSettings;
  loans: LoanRecord[];
  paymentMethods: PaymentMethodConfig[];
  currentUser: UserAccount | null;
  currentRole: UserRole;
  onOpenSignIn: () => void;
  onOpenLedger: () => void;
  onRequestLoan: (principal: number, months: number) => void;
  onRepayLoan: (payload: {
    loanId: string;
    amount: number;
    method: string;
    referenceNo?: string;
    proofImage?: string;
  }) => void;
}

export const PautanganView: React.FC<PautanganViewProps> = ({
  settings,
  loans,
  paymentMethods,
  currentUser,
  currentRole,
  onOpenSignIn,
  onOpenLedger,
  onRequestLoan,
  onRepayLoan,
}) => {
  const availableTerms = useMemo(
    () =>
      settings.availableTerms.length > 0
        ? [...settings.availableTerms].sort((a, b) => a - b)
        : [1, 2, 3],
    [settings.availableTerms]
  );

  const [principalInput, setPrincipalInput] = useState('1000');
  const [months, setMonths] = useState<number>(availableTerms[0] ?? 1);
  const [repayModalLoan, setRepayModalLoan] = useState<LoanRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState('');

  const repayableMethods = useMemo(
    () =>
      paymentMethods.filter(
        (m) => m.enabled && (m.type === 'cash' || m.type === 'digital')
      ),
    [paymentMethods]
  );

  const [repayMethodId, setRepayMethodId] = useState<string>(
    repayableMethods.find((m) => m.type === 'digital')?.id ??
      repayableMethods[0]?.id ??
      'pm-cash'
  );
  const [repayRef, setRepayRef] = useState('');
  const [repayProof, setRepayProof] = useState('');
  const [banner, setBanner] = useState('');

  const isGuest = currentRole === UserRole.Guest || !currentUser;
  const userLoans = currentUser ? loans.filter((l) => l.userId === currentUser.id) : [];
  const activeOutstanding = userLoans
    .filter((l) => l.status === 'Active')
    .reduce((sum, l) => sum + l.remainingBalance, 0);

  const hasCurrentDebtToPay =
    Boolean(currentUser) && ((currentUser?.debtBalance ?? 0) > 0 || activeOutstanding > 0);

  const creditLimit = currentUser?.pautanganLimit ?? 0;
  const availableCredit = Math.max(0, creditLimit - activeOutstanding);
  const userEligible =
    !isGuest && settings.globalEnabled && Boolean(currentUser?.pautanganEnabled);

  const selectedTermMonths = availableTerms.includes(months)
    ? months
    : availableTerms[0] ?? 1;

  const numericPrincipal = Math.max(0, Number(principalInput) || 0);
  const interestTotal = Math.round(
    numericPrincipal * (settings.monthlyInterestRate / 100) * selectedTermMonths
  );
  const totalPayable = numericPrincipal + interestTotal;

  const selectedRepayMethod =
    repayableMethods.find((m) => m.id === repayMethodId) ?? repayableMethods[0];

  const handleLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEligible || hasCurrentDebtToPay) return;
    if (numericPrincipal < 100 || numericPrincipal > availableCredit) return;
    onRequestLoan(numericPrincipal, selectedTermMonths);
    setBanner(
      `Cash assistance of ${formatPHP(numericPrincipal)} (${selectedTermMonths} mo term) approved & payment schedule generated.`
    );
    setTimeout(() => setBanner(''), 5000);
  };

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setRepayProof(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayModalLoan || !selectedRepayMethod) return;
    const amt = Math.min(
      repayModalLoan.remainingBalance,
      Math.max(1, Number(repayAmount) || 0)
    );
    onRepayLoan({
      loanId: repayModalLoan.id,
      amount: amt,
      method: selectedRepayMethod.title,
      referenceNo: repayRef.trim() || undefined,
      proofImage: repayProof || undefined,
    });
    setBanner(
      selectedRepayMethod.type === 'cash'
        ? `Cash repayment of ${formatPHP(amt)} applied to ${repayModalLoan.id}.`
        : `${selectedRepayMethod.title} repayment proof submitted for Admin verification.`
    );
    setRepayModalLoan(null);
    setRepayRef('');
    setRepayProof('');
    setTimeout(() => setBanner(''), 5000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
          Pautangan (Cash Assistance)
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Short-term department cash assistance with transparent monthly interest, automatic installment schedules, and {settings.dueDays[0]}th/{settings.dueDays[1]}th repayment cutoffs.
        </p>
      </div>

      {banner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Program Status</div>
          <div className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
            {!settings.globalEnabled
              ? 'Paused Globally'
              : isGuest
                ? 'Sign In Required'
                : currentUser.pautanganEnabled
                  ? 'Enabled for You'
                  : 'Disabled by Admin'}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Monthly Interest Rate</div>
          <div className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {settings.monthlyInterestRate}% / mo
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Your Credit Limit</div>
          <div className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {isGuest ? '—' : formatPHP(creditLimit)}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5">
          <div className="text-xs text-stone-500 dark:text-stone-400">Available to Borrow</div>
          <div className="mt-1 text-lg font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
            {isGuest ? '—' : hasCurrentDebtToPay ? 'Settle Current Debt' : formatPHP(availableCredit)}
          </div>
        </div>
      </div>

      {isGuest ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-8 text-center">
          <Lock className="w-8 h-8 text-stone-400 mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-stone-900 dark:text-stone-100">
            Sign in to check your Pautangan eligibility
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            Coworkers can view their credit limits, apply for cash assistance, and review automatic installment schedules after signing in.
          </p>
          <button
            type="button"
            onClick={onOpenSignIn}
            className="mt-5 min-h-[44px] rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
          >
            Sign In with Gmail / Email
          </button>
        </div>
      ) : !userEligible ? (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-amber-950 dark:text-amber-200">
              {!settings.globalEnabled
                ? 'Pautangan is temporarily paused department-wide'
                : 'Pautangan access is currently disabled for your profile'}
            </h2>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-300">
              Contact the Pantry Admin to enable Pautangan eligibility or update credit limits.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Request Cash Assistance Form OR Unpaid Debt Notice */}
          {hasCurrentDebtToPay ? (
            <div className="lg:col-span-5 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-amber-950 dark:text-amber-200">
                    New Cash Assistance Locked — Unpaid Balance Found
                  </h2>
                  <p className="mt-1 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                    The Request Cash Assistance form is hidden while you have an active balance to settle. Settle your current store debt or active loan first to unlock new loan requests.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-white dark:bg-[#121D1B] p-4 space-y-2 text-xs">
                {(currentUser?.debtBalance ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-600 dark:text-stone-400">Open Store Credit Debt</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                      {formatPHP(currentUser?.debtBalance ?? 0, true)}
                    </span>
                  </div>
                )}
                {activeOutstanding > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-600 dark:text-stone-400">Active Pautangan Loan</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                      {formatPHP(activeOutstanding, true)}
                    </span>
                  </div>
                )}
              </div>

              {(currentUser?.debtBalance ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={onOpenLedger}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-teal-800 cursor-pointer"
                >
                  <span>Go to My Ledger to Settle Store Debt</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleLoanSubmit}
              className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    Request Cash Assistance
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Max available: {formatPHP(availableCredit)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Loan Principal (₱100 – {formatPHP(availableCredit)})
                </label>
                <input
                  type="number"
                  min="100"
                  max={availableCredit}
                  step="50"
                  value={principalInput}
                  onChange={(e) => setPrincipalInput(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-base font-mono tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Repayment Term (Configured by Super Admin)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {availableTerms.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths(m)}
                      className={`min-h-[40px] rounded-xl border text-xs font-semibold cursor-pointer ${
                        selectedTermMonths === m
                          ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#172523]'
                      }`}
                    >
                      {m} {m === 1 ? 'Month' : 'Months'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-4 space-y-2 text-xs">
                <div className="flex justify-between text-stone-600 dark:text-stone-300">
                  <span>Principal</span>
                  <span className="font-mono tabular-nums font-medium text-stone-900 dark:text-stone-100">
                    {formatPHP(numericPrincipal, true)}
                  </span>
                </div>
                <div className="flex justify-between text-stone-600 dark:text-stone-300">
                  <span>
                    Interest ({settings.monthlyInterestRate}% × {selectedTermMonths} mo)
                  </span>
                  <span className="font-mono tabular-nums font-medium text-stone-900 dark:text-stone-100">
                    {formatPHP(interestTotal, true)}
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between text-sm font-bold text-stone-900 dark:text-stone-100">
                  <span>Total Payable ({selectedTermMonths} installments)</span>
                  <span className="font-mono tabular-nums text-teal-700 dark:text-teal-400">
                    {formatPHP(totalPayable, true)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={numericPrincipal < 100 || numericPrincipal > availableCredit}
                className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-500 transition-colors cursor-pointer"
              >
                Submit Loan Request
              </button>
            </form>
          )}

          {/* Auto-Populated Loan & Term Payment History */}
          <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Cash Assistance Payment History &amp; Term Schedule
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Automatically populated from your chosen loan term and cutoff dates ({settings.dueDays[0]}th &amp; {settings.dueDays[1]}th).
              </p>
            </div>

            {userLoans.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-500 dark:text-stone-400">
                You have no active or past Pautangan loans yet.
              </div>
            ) : (
              <div className="divide-y divide-stone-200 dark:divide-stone-800">
                {userLoans.map((loan) => (
                  <div key={loan.id} className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          <span className="font-mono font-semibold text-stone-700 dark:text-stone-200">
                            {loan.id}
                          </span>{' '}
                          · {loan.createdAt} · {loan.interestRate}%/mo · Chosen Term:{' '}
                          <strong className="text-stone-800 dark:text-stone-200">
                            {loan.months} {loan.months === 1 ? 'Month' : 'Months'}
                          </strong>
                        </div>
                        <div className="mt-1 text-base font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                          {formatPHP(loan.principal)} principal → {formatPHP(loan.totalPayable)} total
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-stone-500 dark:text-stone-400">Remaining</div>
                          <div
                            className={`text-sm font-bold font-mono tabular-nums ${
                              loan.remainingBalance > 0
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {loan.remainingBalance > 0
                              ? formatPHP(loan.remainingBalance, true)
                              : 'Settled'}
                          </div>
                        </div>

                        {loan.remainingBalance > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setRepayModalLoan(loan);
                              setRepayAmount(String(loan.remainingBalance));
                            }}
                            className="min-h-[38px] rounded-xl bg-stone-900 dark:bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-teal-800 cursor-pointer"
                          >
                            Pay Installment
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Auto-populated Term Installment Schedule */}
                    {loan.installments && loan.installments.length > 0 && (
                      <div className="rounded-xl bg-stone-50 dark:bg-[#172523] border border-stone-200 dark:border-stone-800 p-3.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200">
                          <CalendarClock className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                          <span>
                            Auto-Populated Term Schedule ({loan.months}{' '}
                            {loan.months === 1 ? 'Month' : 'Months'})
                          </span>
                        </div>
                        <div className="divide-y divide-stone-200 dark:divide-stone-800">
                          {loan.installments.map((inst) => (
                            <div
                              key={inst.id}
                              className="py-2 first:pt-1 last:pb-0 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="text-stone-700 dark:text-stone-300">
                                <span className="font-semibold">
                                  Term {inst.termNumber} of {inst.totalTerms}
                                </span>{' '}
                                · Due <span className="font-mono">{inst.dueDate}</span>
                                {inst.method ? ` · Paid via ${inst.method}` : ''}
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className={`font-semibold ${
                                    inst.status === 'Paid'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : inst.status === 'Pending Verification'
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-stone-600 dark:text-stone-400'
                                  }`}
                                >
                                  {inst.status}
                                </span>
                                <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                                  {formatPHP(inst.amount, true)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actual Repayments Log */}
                    {loan.repayments.length > 0 && (
                      <div className="rounded-xl bg-stone-50/70 dark:bg-[#0F1917] border border-stone-200 dark:border-stone-800 p-3 space-y-1.5">
                        <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                          Confirmed Payment Transactions
                        </div>
                        {loan.repayments.map((rep) => (
                          <div
                            key={rep.id}
                            className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400"
                          >
                            <span>
                              {rep.date} · {rep.method} · {rep.note}
                            </span>
                            <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                              {formatPHP(rep.amount, true)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {repayModalLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <form
            onSubmit={handleRepaySubmit}
            className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Repay Loan {repayModalLoan.id}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Remaining balance: {formatPHP(repayModalLoan.remainingBalance, true)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRepayModalLoan(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Payment Amount (₱)
              </label>
              <input
                type="number"
                min="1"
                max={repayModalLoan.remainingBalance}
                required
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono tabular-nums text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Channel
              </label>
              <div className="grid grid-cols-2 gap-2">
                {repayableMethods.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setRepayMethodId(ch.id)}
                    className={`min-h-[40px] rounded-xl border px-3 text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                      selectedRepayMethod?.id === ch.id
                        ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {ch.iconImage && (
                      <img
                        src={ch.iconImage}
                        alt={ch.title}
                        className="w-4 h-4 rounded object-cover shrink-0"
                      />
                    )}
                    <span className="truncate">{ch.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedRepayMethod?.type === 'digital' && (
              <div className="space-y-3">
                <PaymentMethodCard
                  method={selectedRepayMethod}
                  amount={Number(repayAmount) || 0}
                />

                <div className="space-y-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5">
                  <input
                    type="text"
                    required
                    value={repayRef}
                    onChange={(e) => setRepayRef(e.target.value)}
                    placeholder={`${selectedRepayMethod.title} Reference No.`}
                    className="w-full min-h-[40px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-3 py-2 text-xs font-mono text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#111B19] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      <span>Upload Proof</span>
                      <input type="file" accept="image/*" onChange={handleProofUpload} className="hidden" />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setRepayProof(SAMPLE_RECEIPT_DATA_URL);
                        if (!repayRef) {
                          setRepayRef(`${selectedRepayMethod.title.slice(0, 2).toUpperCase()}-5590123`);
                        }
                      }}
                      className="min-h-[38px] rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-[#111B19] px-3 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 cursor-pointer"
                    >
                      Use Sample Receipt
                    </button>
                  </div>
                  {repayProof && (
                    <img
                      src={repayProof}
                      alt="Loan repayment proof preview"
                      className="w-16 h-16 object-cover rounded-lg border border-stone-200 dark:border-stone-700"
                    />
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
            >
              Submit Repayment
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
