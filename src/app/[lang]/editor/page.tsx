import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import EditorStudio from "@/components/editor/EditorStudio";

export default async function EditorPage({ params }: PageProps<"/[lang]/editor">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <EditorStudio lang={lang} dict={dict} />;
}
