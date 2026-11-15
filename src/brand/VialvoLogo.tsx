// Marca Vialvo em SVG: o símbolo (um "V" que também lê como um check de aprovado) e o nome.
export function VialvoMark({ className = 'w-8 h-8', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden fill={color}>
      <path d="M2 10h17a8 8 0 0 1 6.9 4L36 31.5 26.5 46H22a8 8 0 0 1-6.9-4z" />
      <path d="M33 2h14.5L37.6 18.7A8 8 0 0 1 30.7 22.6H24z" />
    </svg>
  );
}

export default function VialvoLogo({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <VialvoMark className="w-8 h-6" color={dark ? '#fff' : 'var(--v-ink)'} />
      <span className="font-display text-[22px] font-semibold tracking-[-0.03em] leading-none" style={{ color: dark ? '#fff' : 'var(--v-ink)' }}>Vialvo</span>
    </span>
  );
}
