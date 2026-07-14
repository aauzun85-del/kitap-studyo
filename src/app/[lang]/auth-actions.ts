"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Tüm auth mantığı tek dosyada — bakım yapan kişi tek bakışta okuyabilsin.
// Server Action seçtik çünkü çerez yazma + yönlendirme tek adımda burada olur.

export type AuthState = { error?: string; notice?: string };

// Açık-yönlendirme (open redirect) güvenliği: yalnız aynı dilin alt yolu kabul.
function safeNext(lang: string, next: string): string {
  const home = `/${lang}`;
  if (!next) return home;
  if (next.startsWith("//") || next.includes("://") || next.includes("\\")) return home;
  if (!next.startsWith(`/${lang}/`)) return home;
  return next;
}

function localize(lang: string, key: string): string {
  const tr: Record<string, string> = {
    invalid: "E-posta veya şifre hatalı.",
    exists: "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.",
    mismatch: "Şifreler eşleşmiyor.",
    weak: "Şifre en az 6 karakter olmalı.",
    inbox:
      "Kaydın alındı! Hesabını etkinleştirmek için e-postana gönderdiğimiz bağlantıya tıkla.",
    resetSent:
      "Bağlantı gönderildi! E-postandaki bağlantıya tıklayarak yeni şifreni belirle. (Gelmezse spam klasörüne bak.)",
    samePass: "Yeni şifre eskisinden farklı olmalı.",
    expired:
      "Bu bağlantının süresi dolmuş. Şifre sıfırlamayı baştan başlatıp yeni bağlantı iste.",
    generic: "Bir şeyler ters gitti. Lütfen tekrar dene.",
  };
  const en: Record<string, string> = {
    invalid: "Wrong email or password.",
    exists: "This email is already registered. Try logging in.",
    mismatch: "Passwords don't match.",
    weak: "Password must be at least 6 characters.",
    inbox:
      "You're signed up! Click the link we emailed you to activate your account.",
    resetSent:
      "Link sent! Click the link in your email to set a new password. (Check your spam folder if it doesn't arrive.)",
    samePass: "The new password must be different from the old one.",
    expired:
      "This link has expired. Start the password reset again to get a new link.",
    generic: "Something went wrong. Please try again.",
  };
  const map = lang === "en" ? en : tr;
  return map[key] ?? map.generic;
}

function mapSupabaseError(lang: string, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return localize(lang, "invalid");
  if (m.includes("already registered") || m.includes("already been registered")) {
    return localize(lang, "exists");
  }
  if (m.includes("at least") || m.includes("password should")) {
    return localize(lang, "weak");
  }
  return localize(lang, "generic");
}

export async function signInAction(
  lang: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(lang, String(formData.get("next") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: mapSupabaseError(lang, error.message) };

  revalidatePath(`/${lang}`, "layout");
  redirect(next); // throws (NEXT_REDIRECT) — try/catch DIŞINDA olmalı
}

export async function signUpAction(
  lang: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(lang, String(formData.get("next") ?? ""));

  if (password !== confirm) return { error: localize(lang, "mismatch") };
  if (password.length < 6) return { error: localize(lang, "weak") };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) return { error: mapSupabaseError(lang, error.message) };

  // Supabase'de "Confirm email" AÇIK ise oturum oluşmaz → kullanıcıya
  // gelen kutusuna bakmasını söyle (yoksa anasayfaya atıp login'e geri sektiririz).
  if (!data.session) return { notice: localize(lang, "inbox") };

  revalidatePath(`/${lang}`, "layout");
  redirect(next);
}

export async function resetRequestAction(
  lang: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: localize(lang, "generic") };

  // Bağlantı, e-postadan tıklanınca /auth/callback üzerinden oturum açar ve
  // kullanıcıyı "yeni şifre belirle" sayfasına götürür.
  const h = await headers();
  const origin =
    h.get("origin") ?? `https://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/${lang}/sifre-yenile`,
  });

  // Kayıtlı olsun olmasın hep aynı mesaj — hangi e-postaların üye olduğunu
  // dışarı sızdırmamak için (standart güvenlik pratiği).
  return { notice: localize(lang, "resetSent") };
}

export async function updatePasswordAction(
  lang: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: localize(lang, "mismatch") };
  if (password.length < 6) return { error: localize(lang, "weak") };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("different from the old")) {
      return { error: localize(lang, "samePass") };
    }
    if (m.includes("session missing") || m.includes("not authenticated")) {
      return { error: localize(lang, "expired") };
    }
    return { error: mapSupabaseError(lang, error.message) };
  }

  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}/projeler`);
}

export async function signOutAction(lang: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}`);
}
