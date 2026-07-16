// Laycoty marka rozeti: indigo→mor degradeli yuvarlatılmış karede beyaz "L".
// SiteHeader/AppShell'deki rozet ve favicon (src/app/icon.svg) ile birebir aynı.
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[10px] text-lg font-extrabold leading-none text-white ${className}`}
      style={{ background: "linear-gradient(135deg, var(--color-accent), #7c3aed)" }}
    >
      L
    </span>
  );
}
