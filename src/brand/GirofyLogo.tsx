// Marca Girofy: um quadrado azul com o "G" e o nome.
export function GirofyMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="var(--v-blue)" />
      <path d="M27.5 14.2A9 9 0 1 0 29 20.6H20.4" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function GirofyLogo({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <GirofyMark className="w-8 h-8" />
      <span className="font-display text-[21px] font-semibold tracking-[-0.03em] leading-none" style={{ color: dark ? '#fff' : 'var(--v-ink)' }}>Girofy</span>
    </span>
  );
}
