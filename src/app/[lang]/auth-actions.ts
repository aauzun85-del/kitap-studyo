"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Tüm auth mantığı tek dosyada — bakım yapan kişi tek bakışta okuyabilsin.
// Server Action seçtik çünkü çerez yazma + yönlendirme tek adımda burada olur.

export type AuthState = { error?: string; notice?: string };

function localize(lang: string, key: string): string {
  const tr: Record<string, string> = {
    invalid: "E-posta veya şifre hatalı.",
    exists: "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.",
    mismatch: "Şifreler eşleşmiyor.",
    weak: "Şifre en az 6 karakter olmalı.",
    inbox:
      "Kaydın alındı! Hesabını etkinleştirmek için e-postana gönderdiğimiz bağlantıya tıkla.",
    generic: "Bir şeyler ters gitti. Lütfen tekrar dene.",
  };
  const en: Record<string, string> = {
    invalid: "Wrong email or password.",
    exists: "This email is already registered. Try logging in.",
    mismatch: "Passwords don't match.",
    weak: "Password must be at least 6 characters.",
    inbox:
      "You're signed up! Click the link we emailed you to activate your account.",
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: mapSupabaseError(lang, error.message) };

  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}`); // throws (NEXT_REDIRECT) — try/catch DIŞINDA olmalı
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
  redirect(`/${lang}`);
}

export async function signOutAction(lang: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}`);
}
