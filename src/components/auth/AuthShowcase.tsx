import Image from "next/image";
import type { Locale } from "@/i18n/config";
import { Spread, landingMock } from "@/components/landing/Landing";

// Giriş / kayıt ekranının sağ paneli (sunucu bileşeni): başlık + kitap maketi
// (açık kitap, arkada ekran çerçevesi, önde kapak) + araç adları.
// Maket tanıtım sayfasındakiyle aynı örnek kitaptır (Bir Şehrin Hafızası).

const COPY = {
  tr: {
    h1a: "Metninden kitabına.",
    h1b: "Her adım tek yerde.",
    sub: "Düzenle. Tasarla. Tamamla.",
    chips: ["AI Editör", "Mizanpaj", "Kapak"],
  },
  en: {
    h1a: "From manuscript to book.",
    h1b: "Every step in one place.",
    sub: "Edit. Design. Finish.",
    chips: ["AI Editor", "Layout", "Cover"],
  },
} as const;

export default function AuthShowcase({ lang }: { lang: Locale }) {
  const t = COPY[lang];
  const m = landingMock(lang);
  return (
    <div className="flex h-full flex-col">
      {/* Spread'in yazı boyu kabın genişliğine bağlı (tanıtım sayfasındaki kuralın aynısı). */}
      <style>{`.lp-spread{container-type:inline-size}.lp-page{font-size:1.76cqw;line-height:1.5}`}</style>
      <h2 className="m-0 text-[clamp(30px,3.3vw,46px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-[var(--au-ink)]">
        {t.h1a}
        <br />
        <span className="text-[var(--au)]">{t.h1b}</span>
      </h2>
      <p className="mt-4 text-[clamp(16px,1.35vw,19px)] text-[var(--au-sub)]">{t.sub}</p>

      {/* Maket */}
      <div className="relative mx-auto mt-6 aspect-[1.32/1] w-full max-w-[680px] flex-1" aria-hidden="true">
        {/* arkadaki ekran çerçevesi */}
        <div className="absolute left-[34%] top-[2%] h-[44%] w-[46%] -rotate-[4deg] rounded-[14px] border-2 border-[var(--au)] bg-[var(--au-panel-hi)] p-[3%]">
          <div className="flex gap-[5px]">
            <span className="h-[6px] w-[6px] rounded-full bg-[var(--au)]" />
            <span className="h-[6px] w-[6px] rounded-full bg-[var(--au)]" />
            <span className="h-[6px] w-[6px] rounded-full bg-[var(--au)]" />
          </div>
          <span className="absolute right-[6%] top-[10%] text-[clamp(11px,1.1vw,15px)] font-semibold text-[var(--au)]">Aa</span>
          <div className="mt-[9%] space-y-[6%] pr-[40%]">
            <div className="h-[2px] rounded bg-[var(--au)] opacity-60" />
            <div className="h-[2px] w-[85%] rounded bg-[var(--au)] opacity-60" />
            <div className="h-[2px] w-[92%] rounded bg-[var(--au)] opacity-60" />
          </div>
        </div>
        {/* açık kitap */}
        <div
          className="absolute bottom-[9%] left-0 w-[68%]"
          style={{ transform: "perspective(1500px) rotateX(22deg) rotateZ(-4deg)", transformOrigin: "center bottom" }}
        >
          <Spread m={m} />
        </div>
        {/* kapak (sayfa kalınlığı gölgeli) */}
        <div className="absolute bottom-[3%] right-[3%] w-[33%] rotate-[3deg]">
          <Image
            src="/landing/kapak-ornek.jpg"
            alt=""
            width={800}
            height={1182}
            sizes="(min-width: 1024px) 230px, 0px"
            className="h-auto w-full rounded-[3px] shadow-[5px_5px_0_#ece6da,9px_9px_0_#e2dccf,18px_26px_40px_rgba(40,30,80,0.28)]"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[clamp(15px,1.25vw,18px)] text-[var(--au-sub)]">
        {t.chips.map((c, i) => (
          <span key={c} className="flex items-center gap-4">
            {i > 0 && <span aria-hidden="true">•</span>}
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
