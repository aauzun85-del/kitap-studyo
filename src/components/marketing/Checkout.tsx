"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import {
  CREDIT_ADDONS,
  CREDIT_PACKAGES,
  PACKAGE_VALIDITY_DAYS,
  PAYMENT_OPEN,
} from "@/lib/credits/pricing";
import { TEST_PACKAGE, shopierProductFor } from "@/lib/credits/shopier";
import { checkCardPayment, startCardPayment } from "@/lib/credits/checkoutActions";
import { COMPANY } from "@/lib/legal/company";

import BillingForm, { EMPTY_BILLING, validateBilling, type BillingErrors } from "./BillingForm";

const ALL = [...CREDIT_PACKAGES, ...CREDIT_ADDONS];

// Satın alma adımları: paket → sipariş özeti → fatura bilgileri → sözleşme onayı → ödeme.
// Kart ödemesi ödeme kuruluşu onayından sonra son adıma bağlanacak; o güne kadar
// (PAYMENT_OPEN = false) bu ekran hiçbir ücret almaz, bunu açıkça söyler ve üyeye
// paketi BUGÜN nasıl alacağını gösterir: bize yazar, paketi biz tanımlarız.
// Dört adım ve kart açıklaması her durumda görünür kalır (ödeme kuruluşu inceler).
//
// KARTLA ÖDEME (Shopier): Shopier'de ürünü açılmış paketlerde (bugün yalnız Eco)
// son düğme "Kartla öde" olur. Shopier bize "şu sipariş için öde" adresi vermez ve
// ödemeden sonra siteye geri döndürmez; bu yüzden üye ödemeyi Shopier'in ürün
// sayfasında, YENİ SEKMEDE yapar, bu sayfa ise "Ödemeni bekliyoruz" ekranına geçip
// ödemeyi 5 saniyede bir sorar. Ödeme, üyenin Shopier'e yazdığı e-posta adresiyle
// eşleşir → ekran üyelik adresini açıkça gösterir. Ürünü olmayan paketlerde
// (Pro, Mega) akış eskisi gibidir: "bize yaz".
const COPY = {
  tr: {
    title: "Satın al",
    subtitle: "Paketini seç, sipariş özetini kontrol et, fatura bilgilerini gir, sözleşmeyi onayla.",
    stepBilling: "Fatura bilgileri",
    needBilling: "Devam etmek için fatura bilgilerindeki eksikleri tamamla.",
    step1: "Paket",
    addons: "Ek jeton",
    addonsHint: "Aktif paketi olan üyeler içindir; bakiyene eklenir, indirme hakkı paketle gelir.",
    addonItem: (name: string) => `Laycoty ${name}`,
    addonContent: (c: string) => `${c} jeton; ${PACKAGE_VALIDITY_DAYS} gün geçerli. İndirme hakkı içermez.`,
    step2: "Sipariş özeti",
    step3: "Onay ve ödeme",
    credits: "jeton",
    days: "gün geçerli",
    item: "Ürün",
    itemValue: (name: string) => `Laycoty ${name} yazılım kullanım paketi`,
    content: "İçerik",
    contentValue: (c: string) => `${c} jeton + ${PACKAGE_VALIDITY_DAYS} gün sınırsız dosya indirme`,
    delivery: "Teslimat",
    deliveryValue: "Dijital hizmet; ödeme onaylanınca hesabına tanımlanır. Kargo yoktur.",
    renewal: "Yenileme",
    renewalValue: "Tek seferlik ödeme; kendiliğinden yenilenmez.",
    total: "Toplam (KDV dahil)",
    agreePre: "",
    info: "Ön Bilgilendirme Formu",
    agreeAnd: "'nu ve ",
    contract: "Mesafeli Satış Sözleşmesi",
    agreePost:
      "'ni okudum, kabul ediyorum. Paket hesabıma tanımlanınca hizmetin onayımla hemen başlayacağını ve bu nedenle cayma hakkımın olmadığını biliyorum; hiç kullanılmamış paketler için ",
    refund: "Teslimat, İptal ve İade Koşulları",
    agreeEnd: " geçerlidir.",
    pay: "Kartla öde",
    needAgree: "Devam etmek için sözleşmeyi onaylamalısın.",
    secure: "Kart bilgilerin ödeme kuruluşunun güvenli ekranına girilecek; Laycoty'ye ulaşmaz.",
    notOpen:
      "Kartla ödeme henüz açık değil: ödeme kuruluşunun onayından sonra güvenli ödeme ekranı tam bu adımda açılacak. Bu sayfada senden ücret alınmaz.",
    today:
      "Paketi bugün almak için bize yaz; hesabına biz tanımlarız. Mesajına paketin adını ve yukarıdaki fatura bilgilerini ekle; faturanı bu bilgilerle keseriz.",
    request: "Paket talebi için bize yaz",
    ready: "Talebin hazır. Şimdi bize yaz; mesajına paketin adını ve yukarıdaki fatura bilgilerini ekle.",
    contact: "İletişim sayfasına git",
    payFailed: "Ödeme ekranı şu an açılamadı. Bize yaz, yardımcı olalım.",
    notOpenPkg:
      "Bu ürün için kartla ödeme henüz açık değil; şimdilik yalnız Eco paketi kartla alınabiliyor. Bu sayfada senden ücret alınmaz.",
    secureCard:
      "Ödeme Shopier'in güvenli ödeme sayfasında yapılır; kart bilgilerin Laycoty'ye ulaşmaz. Taksit seçeneklerini ve varsa taksit farkını Shopier ödeme sırasında gösterir; taksit farkı tutara eklenir.",
    starting: "Hazırlanıyor…",
    needLogin: "Kartla ödemek için önce giriş yap ya da ücretsiz üye ol.",
    login: "Giriş yap",
    needConfirm:
      "Kartla ödeme için önce e-posta adresini doğrula. Kayıt olurken gönderdiğimiz e-postadaki bağlantıya tıkla, sonra bu sayfayı yenile.",
    waitTitle: "Ödemeni bekliyoruz",
    waitFor: (name: string, price: string) => `Laycoty ${name} · ${price} ₺`,
    waitStep1: "Açılan Shopier sayfasında kartınla öde.",
    waitStep2a: "E-posta alanına Laycoty üyelik adresini yaz: ",
    waitStep2b: ". Başka bir adres yazarsan ödemen hesabınla kendiliğinden eşleşmez.",
    waitStep3: "Ödeme tamamlanınca bu sayfaya dön; paketin birkaç saniye içinde tanımlanır.",
    openShopier: "Shopier ödeme sayfasını aç",
    newTab: "Yeni sekmede açılır; bu sayfa açık kalsın.",
    polling: "Ödemen bekleniyor; bu sayfa kendiliğinden güncellenir.",
    checkNow: "Ödedim, kontrol et",
    checking: "Kontrol ediliyor…",
    notYet: "Ödemen henüz görünmüyor. Birkaç saniye içinde yeniden bakacağız.",
    timedOut: (mail: string) => `Hâlâ görünmüyor mu? Bize yaz: ${mail}`,
    backToForm: "Geri dön (paketi ya da fatura bilgilerini değiştir)",
    doneTitle: "Ödemen alındı, paketin tanımlandı",
    doneText: "Jetonların hesabına eklendi. Faturan, girdiğin fatura bilgileriyle e-posta adresine gönderilecek.",
    doneLink: "Projelerime git",
    closedTitle: "Bu sipariş kapatılmış",
    closedText: "Bu sipariş artık ödeme beklemiyor. Ödeme yaptıysan bize yaz; yapmadıysan baştan başlayabilirsin.",
    restart: "Baştan başla",
    authTitle: "Oturumun kapanmış",
    authText: "Giriş yap; ödemen kaybolmaz, giriş yapınca kontrol edilir.",
  },
  en: {
    title: "Checkout",
    subtitle: "Choose your package, review your order, enter your invoice details and accept the agreement.",
    stepBilling: "Invoice details",
    needBilling: "Please complete the invoice details to continue.",
    step1: "Package",
    addons: "Extra credits",
    addonsHint: "For members with an active package; added to your balance. Download rights come with a package.",
    addonItem: (name: string) => `Laycoty ${name}`,
    addonContent: (c: string) => `${c} credits; valid for ${PACKAGE_VALIDITY_DAYS} days. Does not include download rights.`,
    step2: "Order summary",
    step3: "Agreement and payment",
    credits: "credits",
    days: "days",
    item: "Item",
    itemValue: (name: string) => `Laycoty ${name} software usage package`,
    content: "Includes",
    contentValue: (c: string) => `${c} credits + unlimited downloads for ${PACKAGE_VALIDITY_DAYS} days`,
    delivery: "Delivery",
    deliveryValue: "Digital service; added to your account once payment is approved. No shipping.",
    renewal: "Renewal",
    renewalValue: "One-time payment; never renews automatically.",
    total: "Total (VAT included)",
    agreePre: "I have read and accept the ",
    info: "Preliminary Information Form",
    agreeAnd: " and the ",
    contract: "Distance Sales Agreement",
    agreePost:
      ". I understand the service starts as soon as the package is added to my account, so there is no right of withdrawal; for unused packages the ",
    refund: "Delivery, Cancellation & Refund Policy",
    agreeEnd: " applies.",
    pay: "Pay by card",
    needAgree: "Please accept the agreement to continue.",
    secure: "Your card details are entered on the payment provider's secure page and never reach Laycoty.",
    notOpen:
      "Card payment is not open yet: the secure payment page will open at this step once the payment provider approves us. Nothing is charged on this page.",
    today:
      "To get the package today, contact us and we will add it to your account. Include the package name and the invoice details above in your message; we issue your invoice with them.",
    request: "Contact us to get this package",
    ready: "Your request is ready. Now contact us; include the package name and the invoice details above in your message.",
    contact: "Go to the Contact page",
    payFailed: "The payment page could not be opened. Contact us and we will help.",
    notOpenPkg:
      "Card payment is not open for this item yet; for now only the Eco package can be bought by card. Nothing is charged on this page.",
    secureCard:
      "You pay on Shopier's secure payment page; your card details never reach Laycoty. Shopier shows any instalment options and instalment surcharge at payment; the surcharge is added to the total.",
    starting: "Preparing…",
    needLogin: "To pay by card, first log in or sign up for free.",
    login: "Log in",
    needConfirm:
      "To pay by card, first confirm your e-mail address. Click the link in the e-mail we sent when you signed up, then reload this page.",
    waitTitle: "Waiting for your payment",
    waitFor: (name: string, price: string) => `Laycoty ${name} · ${price} ₺`,
    waitStep1: "Pay with your card on the Shopier page that opens.",
    waitStep2a: "In the e-mail field, enter your Laycoty member address: ",
    waitStep2b: ". If you enter a different address, your payment will not be matched to your account automatically.",
    waitStep3: "When the payment is complete, come back to this page; your package is added within a few seconds.",
    openShopier: "Open the Shopier payment page",
    newTab: "Opens in a new tab; keep this page open.",
    polling: "Waiting for your payment; this page updates by itself.",
    checkNow: "I have paid, check now",
    checking: "Checking…",
    notYet: "Your payment is not visible yet. We will look again in a few seconds.",
    timedOut: (mail: string) => `Still not showing? Write to us: ${mail}`,
    backToForm: "Go back (change the package or invoice details)",
    doneTitle: "Payment received, your package is active",
    doneText: "Your credits have been added to your account. Your invoice will be e-mailed using the invoice details you entered.",
    doneLink: "Go to my projects",
    closedTitle: "This order is closed",
    closedText: "This order is no longer waiting for payment. If you have paid, write to us; if not, you can start again.",
    restart: "Start again",
    authTitle: "You have been signed out",
    authText: "Log in again; your payment is not lost and is checked once you are logged in.",
  },
} as const;

// 30 dakika sonra kendiliğinden sormayı bırak (sekme açık unutulursa boşuna sormasın).
const POLL_MS = 5000;
const POLL_MAX_MS = 30 * 60 * 1000;

type Waiting = { orderId: string; packageId: string };

export default function Checkout({
  lang,
  initialId,
  cardReady = false,
  allowTest = false,
  loggedIn = false,
  email = null,
  emailConfirmed = false,
  resume = null,
}: {
  lang: Locale;
  initialId?: string;
  /** Sunucuda Shopier bağlantısı hazır mı? (Paketin ürünü var mı ayrıca bakılır.) */
  cardReady?: boolean;
  /** Gizli deneme paketi listeye eklensin mi? (Yalnız yönetici.) */
  allowTest?: boolean;
  loggedIn?: boolean;
  /** Üyelik e-postası: Shopier'de yazılması gereken adres. */
  email?: string | null;
  emailConfirmed?: boolean;
  /** Ödeme bekleyen kart siparişi (sayfa yenilenince bekleme ekranı geri gelsin). */
  resume?: Waiting | null;
}) {
  const t = COPY[lang];
  const nf = lang === "tr" ? "tr-TR" : "en-US";
  const router = useRouter();
  const list = allowTest ? [...ALL, TEST_PACKAGE] : ALL;
  const fallback = CREDIT_PACKAGES.find((p) => p.badge) ?? CREDIT_PACKAGES[0];
  const [id, setId] = useState(
    list.some((p) => p.id === initialId) ? (initialId as string) : fallback.id,
  );
  const [accepted, setAccepted] = useState(false);
  const [note, setNote] = useState<"billing" | "agree" | "closed" | "login" | "confirm" | "failed" | null>(null);
  const [billing, setBilling] = useState(EMPTY_BILLING);
  const [billingErrors, setBillingErrors] = useState<BillingErrors>({});
  const [starting, setStarting] = useState(false);
  // Kartla ödeme başlatıldıysa: beklenen sipariş ve durumu.
  const [wait, setWait] = useState<Waiting | null>(resume);
  const [payStatus, setPayStatus] = useState<"pending" | "approved" | "other" | "auth">("pending");
  const [timedOut, setTimedOut] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const pkg = list.find((p) => p.id === id) ?? fallback;
  const isAddon = !CREDIT_PACKAGES.some((p) => p.id === pkg.id);
  const credits = pkg.credits.toLocaleString(nf);
  // Bu paket şu an kartla alınabiliyor mu?
  const card = cardReady && !!shopierProductFor(pkg.id);
  const waitOrderId = wait?.orderId ?? null;

  // Bekleme ekranı açıkken ödemeyi 5 saniyede bir sor. Üye Shopier sekmesinden
  // geri döndüğünde (telefonda zamanlayıcılar uyur) beklemeden hemen bir kez sor.
  useEffect(() => {
    if (!waitOrderId || payStatus !== "pending" || timedOut) return;
    const started = Date.now();
    let stopped = false;
    let busy = false;
    const tick = async () => {
      if (stopped || busy) return;
      if (Date.now() - started > POLL_MAX_MS) {
        setTimedOut(true);
        return;
      }
      busy = true;
      try {
        const r = await checkCardPayment(waitOrderId);
        if (stopped) return;
        if (r.status !== "pending") {
          setPayStatus(r.status);
          // Üst menüdeki jeton bakiyesi de tazelensin.
          if (r.status === "approved") router.refresh();
        }
      } catch {
        // Ağ hatası: bir sonraki turda yeniden denenir.
      } finally {
        busy = false;
      }
    };
    const first = window.setTimeout(tick, 1000);
    const timer = window.setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [waitOrderId, payStatus, timedOut, router]);

  // "Ödedim, kontrol et": üye beklemek istemezse elle sorar (sunucu yine de
  // Shopier'e 4 saniyede birden sık sormaz).
  async function checkNow() {
    if (!waitOrderId || checking) return;
    setChecking(true);
    setNotYet(false);
    try {
      const r = await checkCardPayment(waitOrderId);
      if (r.status === "pending") setNotYet(true);
      else {
        setPayStatus(r.status);
        if (r.status === "approved") router.refresh();
      }
    } catch {
      setNotYet(true);
    } finally {
      setChecking(false);
    }
  }

  async function pay() {
    // Giriş denetimi EN BAŞTA: form doldurulduktan sonra girişe gönderilirse
    // (aynı sekme) yazılan fatura bilgileri silinirdi.
    if (card && !loggedIn) return setNote("login");
    const errs = validateBilling(billing, lang);
    setBillingErrors(errs);
    if (Object.keys(errs).length) {
      setNote("billing");
      document.getElementById(`fatura-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    if (!accepted) return setNote("agree");
    // Ürünü olmayan paket: eskisi gibi "bize yaz" notu.
    if (!card) return setNote("closed");
    setStarting(true);
    setNote(null);
    try {
      const r = await startCardPayment(lang, pkg.id, billing, accepted);
      if (r.ok) {
        setPayStatus("pending");
        setTimedOut(false);
        setNotYet(false);
        setWait({ orderId: r.orderId, packageId: pkg.id });
        window.scrollTo({ top: 0 });
      } else {
        setNote(
          r.error === "auth"
            ? "login"
            : r.error === "email-unconfirmed"
              ? "confirm"
              : r.error === "billing"
                ? "billing"
                : r.error === "terms"
                  ? "agree"
                  : "failed",
        );
      }
    } catch {
      setNote("failed");
    } finally {
      setStarting(false);
    }
  }

  const heading = "mb-3 font-sans text-lg font-extrabold";
  const row = "grid gap-0.5 px-4 py-3 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4";
  const link = "font-semibold text-accent underline";
  const gradient = { background: "linear-gradient(135deg, var(--color-accent) 0%, #7c3aed 100%)" };

  // ───────── ÖDEME BEKLENİYOR / TAMAMLANDI ─────────
  if (wait) {
    const waitPkg = [...ALL, TEST_PACKAGE].find((p) => p.id === wait.packageId);
    const payUrl = shopierProductFor(wait.packageId)?.url;
    const back = () => {
      setWait(null);
      setPayStatus("pending");
      setTimedOut(false);
      setNotYet(false);
      setNote(null);
    };
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        {payStatus === "approved" ? (
          <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <h1 className="font-sans text-2xl font-extrabold tracking-tight">{t.doneTitle}</h1>
            <p className="mt-2 text-base leading-relaxed">{t.doneText}</p>
            <Link
              href={`/${lang}/projeler`}
              className="mt-5 inline-block rounded-full px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
              style={gradient}
            >
              {t.doneLink}
            </Link>
          </div>
        ) : payStatus === "auth" ? (
          // Oturum düşmüş: sipariş hâlâ bekliyor, "kapatılmış" DEĞİL.
          <div role="status" className="rounded-2xl border border-border bg-surface p-6">
            <h1 className="font-sans text-2xl font-extrabold tracking-tight">{t.authTitle}</h1>
            <p className="mt-2 text-base leading-relaxed text-foreground/85">{t.authText}</p>
            <Link
              href={`/${lang}/giris?next=${encodeURIComponent(`/${lang}/satin-al?paket=${wait.packageId}`)}`}
              className="mt-5 inline-block rounded-full px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
              style={gradient}
            >
              {t.login}
            </Link>
          </div>
        ) : payStatus === "other" ? (
          <div role="status" className="rounded-2xl border border-border bg-surface p-6">
            <h1 className="font-sans text-2xl font-extrabold tracking-tight">{t.closedTitle}</h1>
            <p className="mt-2 text-base leading-relaxed text-foreground/85">
              {t.closedText}{" "}
              <Link href={`/${lang}/iletisim`} target="_blank" className={link}>
                {t.contact}
              </Link>
            </p>
            <button type="button" onClick={back} className="mt-5 rounded-full border border-border bg-background px-6 py-3 text-sm font-bold">
              {t.restart}
            </button>
          </div>
        ) : (
          <>
            <h1 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">{t.waitTitle}</h1>
            {waitPkg && (
              <p className="mt-2 text-muted">{t.waitFor(waitPkg.name[lang], waitPkg.priceTry.toLocaleString(nf))}</p>
            )}
            <ol className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5 text-base leading-relaxed text-foreground/85">
              <li>1. {t.waitStep1}</li>
              <li>
                2. {t.waitStep2a}
                <strong className="break-all text-foreground">{email}</strong>
                {t.waitStep2b}
              </li>
              <li>3. {t.waitStep3}</li>
            </ol>
            {/* Gerçek bağlantı: beklemeden sonra window.open açılır pencere engeline takılır. */}
            {payUrl && (
              <a
                href={payUrl}
                target="_blank"
                rel="noopener"
                className="mt-5 block w-full rounded-full py-3.5 text-center text-sm font-bold text-white transition hover:opacity-90"
                style={gradient}
              >
                {t.openShopier} ↗
              </a>
            )}
            <p className="mt-2 text-center text-xs text-muted">{t.newTab}</p>

            <div role="status" className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              {timedOut ? (
                <p>{t.timedOut(COMPANY.email)}</p>
              ) : (
                <p className="flex items-center gap-2 text-muted">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-accent" aria-hidden />
                  {t.polling}
                </p>
              )}
              {notYet && <p className="mt-2 text-amber-800 dark:text-amber-300">{t.notYet}</p>}
              <button
                type="button"
                onClick={checkNow}
                disabled={checking}
                className="mt-3 rounded-full border border-border bg-background px-5 py-2 text-sm font-bold transition hover:border-foreground/30 disabled:opacity-60"
              >
                {checking ? t.checking : t.checkNow}
              </button>
            </div>
            <button type="button" onClick={back} className="mt-5 text-sm text-muted underline hover:text-foreground">
              {t.backToForm}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <h1 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h1>
      <p className="mt-2 text-muted">{t.subtitle}</p>

      <section className="mt-8">
        <h2 id="paket-baslik" className={heading}>1. {t.step1}</h2>
        <div role="radiogroup" aria-labelledby="paket-baslik" className="space-y-2">
          {list.map((p, idx) => {
            const on = p.id === id;
            const firstAddon = idx === CREDIT_PACKAGES.length;
            return (
              <div key={p.id}>
                {firstAddon && (
                  <div className="mb-2 mt-5">
                    <div className="font-sans text-base font-extrabold">{t.addons}</div>
                    <div className="text-xs text-muted">{t.addonsHint}</div>
                  </div>
                )}
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                  on ? "border-accent bg-accent-soft" : "border-border bg-surface"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paket"
                    checked={on}
                    onChange={() => {
                      setId(p.id);
                      setNote(null);
                    }}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block font-bold">{p.name[lang]}</span>
                    <span className="block text-xs text-muted">
                      {p.credits.toLocaleString(nf)} {t.credits} · {PACKAGE_VALIDITY_DAYS} {t.days}
                    </span>
                  </span>
                </span>
                <span className="whitespace-nowrap font-extrabold">{p.priceTry.toLocaleString(nf)} ₺</span>
              </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className={heading}>2. {t.step2}</h2>
        <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface text-sm">
          {[
            [t.item, isAddon ? t.addonItem(pkg.name[lang]) : t.itemValue(pkg.name[lang])],
            [t.content, isAddon ? t.addonContent(credits) : t.contentValue(credits)],
            [t.delivery, t.deliveryValue],
            [t.renewal, t.renewalValue],
          ].map(([k, v]) => (
            <div key={k} className={row}>
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
          <div className={`${row} bg-background`}>
            <dt className="font-bold">{t.total}</dt>
            <dd className="text-xl font-extrabold text-accent">{pkg.priceTry.toLocaleString(nf)} ₺</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className={heading}>3. {t.stepBilling}</h2>
        <BillingForm
          lang={lang}
          value={billing}
          errors={billingErrors}
          onChange={(next) => {
            setBilling(next);
            // Hata gösterildikten sonra yazdıkça güncellensin.
            if (Object.keys(billingErrors).length) setBillingErrors(validateBilling(next, lang));
            setNote(null);
          }}
        />
      </section>

      <section className="mt-8">
        <h2 className={heading}>4. {t.step3}</h2>
        {!PAYMENT_OPEN && !card && (
          <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {/* Kart başka pakette açıkken "kartla ödeme açık değil" demek yanlış olur. */}
            {cardReady ? t.notOpenPkg : t.notOpen} {t.today}{" "}
            <Link href={`/${lang}/iletisim`} target="_blank" className="font-semibold underline">
              {t.contact}
            </Link>
          </p>
        )}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-base leading-relaxed text-foreground/85">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);
              setNote(null);
            }}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          />
          <span>
            {t.agreePre}
            <Link href={`/${lang}/yasal/on-bilgilendirme-formu`} target="_blank" className={link}>
              {t.info}
            </Link>
            {t.agreeAnd}
            <Link href={`/${lang}/yasal/mesafeli-satis-sozlesmesi`} target="_blank" className={link}>
              {t.contract}
            </Link>
            {t.agreePost}
            <Link href={`/${lang}/yasal/iptal-ve-iade`} target="_blank" className={link}>
              {t.refund}
            </Link>
            {t.agreeEnd}
          </span>
        </label>

        {card && !loggedIn ? (
          // Girişsiz kartla ödenmez: düğme yerine BAŞTAN söyle (form boşa doldurulmasın).
          <p
            role="status"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {t.needLogin}{" "}
            <Link
              href={`/${lang}/giris?next=${encodeURIComponent(`/${lang}/satin-al?paket=${pkg.id}`)}`}
              className="font-semibold underline"
            >
              {t.login}
            </Link>
          </p>
        ) : card && loggedIn && !emailConfirmed ? (
          // E-posta doğrulanmadan sipariş açılmaz: ödeme o adresle eşleşecek.
          <p
            role="status"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {t.needConfirm}
          </p>
        ) : (
          <button
            type="button"
            onClick={pay}
            disabled={starting}
            className="mt-4 w-full rounded-full py-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={gradient}
          >
            {starting ? t.starting : `${card || PAYMENT_OPEN ? t.pay : t.request} · ${pkg.priceTry.toLocaleString(nf)} ₺`}
          </button>
        )}
        <p className="mt-2 text-center text-xs text-muted">{card ? t.secureCard : t.secure}</p>

        {note && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {note === "billing"
              ? t.needBilling
              : note === "agree"
                ? t.needAgree
                : note === "login"
                  ? t.needLogin
                  : note === "confirm"
                    ? t.needConfirm
                    : note === "failed" || PAYMENT_OPEN
                      ? t.payFailed
                      : t.ready}
            {note === "login" && (
              <>
                {" "}
                <Link
                  href={`/${lang}/giris?next=${encodeURIComponent(`/${lang}/satin-al?paket=${pkg.id}`)}`}
                  className="font-semibold underline"
                >
                  {t.login}
                </Link>
              </>
            )}
            {(note === "closed" || note === "failed") && (
              <>
                {" "}
                {/* Yeni sekmede açılır: girilen fatura bilgileri bu sayfada kalsın. */}
                <Link href={`/${lang}/iletisim`} target="_blank" className="font-semibold underline">
                  {t.contact}
                </Link>
              </>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
