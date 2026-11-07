import { ReactNode } from 'react';

// Peças visuais compartilhadas da central Girofy IA. Mesmo vocabulário do painel (iOS claro):
// fundo #f5f5f7, cartões brancos de 24px, azul #0071E3, verde #34C759, laranja #FF9500, vermelho #FF3B30.

export const COLORS = { blue: '#0071E3', green: '#34C759', orange: '#FF9500', red: '#FF3B30', gray: '#86868B' };

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`apple-widget p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function SectionTitle({ icon, title, hint, right }: { icon?: ReactNode; title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] flex items-center gap-2">
          {icon && <span className="text-[#0071E3] shrink-0">{icon}</span>}
          {title}
        </h2>
        {hint && <p className="text-[13px] text-[#86868B] mt-0.5 leading-snug">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

type Tone = 'green' | 'orange' | 'red' | 'blue' | 'gray';
const toneClass: Record<Tone, string> = {
  green: 'bg-[#34C759]/12 text-[#1f8a3a]',
  orange: 'bg-[#FF9500]/14 text-[#b36b00]',
  red: 'bg-[#FF3B30]/12 text-[#c42b22]',
  blue: 'bg-[#0071E3]/10 text-[#0071E3]',
  gray: 'bg-black/[0.05] text-[#6e6e73]',
};

export function Pill({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${toneClass[tone]}`}>{children}</span>;
}

export function Dot({ tone }: { tone: Tone }) {
  const c = tone === 'green' ? COLORS.green : tone === 'orange' ? COLORS.orange : tone === 'red' ? COLORS.red : tone === 'blue' ? COLORS.blue : COLORS.gray;
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: c }} />;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-[46px] h-[28px] rounded-full transition-colors duration-200 shrink-0 ${on ? 'bg-[#34C759]' : 'bg-black/[0.16]'}`}
    >
      <span className={`absolute top-[2px] left-[2px] w-[24px] h-[24px] rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-[18px]' : ''}`} />
    </button>
  );
}

export function Btn({
  children, onClick, kind = 'primary', disabled, type = 'button',
}: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'soft' | 'danger'; disabled?: boolean; type?: 'button' | 'submit' }) {
  const styles =
    kind === 'primary' ? 'bg-[#0071E3] text-white active:bg-[#0062c4]'
    : kind === 'danger' ? 'bg-[#FF3B30]/10 text-[#c42b22] active:bg-[#FF3B30]/20'
    : 'bg-black/[0.05] text-[#1D1D1F] active:bg-black/[0.09]';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 rounded-xl text-[14px] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${styles}`}
    >
      {children}
    </button>
  );
}

export const inputCls =
  'w-full rounded-xl border border-black/[0.1] bg-[#FBFBFD] px-3.5 py-2.5 text-[15px] text-[#1D1D1F] placeholder:text-[#a1a1a6] outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 transition';

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-[#FBFBFD] border border-dashed border-black/[0.1] px-4 py-8 text-center">
      <div className="text-[15px] font-semibold text-[#1D1D1F]">{title}</div>
      {hint && <div className="text-[13px] text-[#86868B] mt-1">{hint}</div>}
    </div>
  );
}

// Anel de progresso (cota, uso). value de 0 a 1.
export function Ring({ value, size = 56, stroke = 7, color = COLORS.blue, children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-[#1D1D1F]">{children}</div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-black/[0.06] ${className}`} />;
}
