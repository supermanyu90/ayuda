import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import type { VerificationStatus } from '../lib/types';

const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const buttonStyles = {
  primary: `${base} bg-forest text-white hover:bg-[#0f2c22]`,
  accent: `${base} bg-marigold text-ink hover:bg-[#e09509]`,
  secondary: `${base} border-2 border-forest bg-card text-forest hover:bg-forest-soft`,
  ghost: `${base} text-forest underline-offset-4 hover:underline`,
  danger: `${base} border-2 border-danger bg-card text-danger hover:bg-danger-soft`,
};

type Variant = keyof typeof buttonStyles;

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: Variant }) {
  return <Link className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

/** Screen title that receives focus on navigation, so screen readers announce the new page. */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <header className="mb-6">
      <h1 ref={ref} tabIndex={-1} className="text-3xl font-extrabold leading-tight text-forest outline-none sm:text-4xl">
        {children}
      </h1>
      {sub && <p className="mt-2 text-lg text-muted">{sub}</p>}
    </header>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-card p-5 shadow-[0_1px_0_rgba(20,37,30,0.06)] ${className}`}>{children}</section>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const styles: Record<VerificationStatus, string> = {
    VERIFIED: 'bg-forest-soft text-forest border-forest/30',
    PENDING: 'bg-marigold-soft text-[#7a4b00] border-marigold',
    UNVERIFIED: 'bg-danger-soft text-danger border-danger/40',
  };
  const label: Record<VerificationStatus, string> = { VERIFIED: '✓ Verified', PENDING: 'Verification pending', UNVERIFIED: 'Not verified' };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-bold ${styles[status]}`}>{label[status]}</span>;
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-demo/40 bg-demo-soft px-2.5 py-0.5 text-sm font-bold text-demo" title="Fictional organisation for demonstration">
      Demo · fictional
    </span>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const styles = {
    info: 'border-forest/30 bg-forest-soft text-ink',
    warn: 'border-marigold bg-marigold-soft text-ink',
    error: 'border-danger/50 bg-danger-soft text-danger',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border-2 px-4 py-3 ${styles[tone]}`}>
      {children}
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-paper px-3 py-1 text-sm font-bold text-ink ring-1 ring-line">{children}</span>;
}

export const pretty = (s: string) => s.replace(/_/g, ' ');

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-muted">
      <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-[3px] border-line border-t-forest" />
      <span>{label}</span>
    </div>
  );
}
