"use client";

// Yazma görünümü — gerçek bir zengin-metin editörü (TipTap/ProseMirror). Enter
// yeni paragraf, serbest yazma, seç-kalın/italik, geri-al, Türkçe klavye hepsi
// motorun içinde. İçerik MARKDOWN olarak dışarı verilir (kayıt = manuscript.text).

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";
import { markdownToHtml, docToMarkdown } from "./markdown";
import { createImageEmbed, TableEmbed, PageBreakEmbed, SpacerEmbed } from "./embeds";
import type { MediaMap } from "@/lib/layout/mediaTokens";

// Uint8Array → base64 (parçalı: String.fromCharCode(...büyük dizi) yığın taşmasını
// önler). Editör resim kartı küçük resmi için data URL kurar.
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function Btn({
  on,
  active,
  children,
  title,
}: {
  on: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        on();
      }}
      className={`min-w-7 rounded px-2 py-1 text-sm transition ${
        active ? "bg-accent text-white" : "text-foreground hover:bg-accent-soft"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
      <Btn title="Kalın (⌘B)" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Btn>
      <Btn title="İtalik (⌘I)" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </Btn>
      <span className="mx-1 h-5 w-px bg-border" />
      <Btn title="Bölüm başlığı" active={editor.isActive("heading", { level: 1 })} on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        H1
      </Btn>
      <Btn title="Alt başlık" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn title="Paragraf" active={editor.isActive("paragraph")} on={() => editor.chain().focus().setParagraph().run()}>
        ¶
      </Btn>
      <span className="mx-1 h-5 w-px bg-border" />
      {/* Sayfa düzeni: imlecin olduğu yere sayfa sonu / boşluk ekle. */}
      <Btn
        title="Sayfa sonu — buradan sonrasını yeni sayfaya at (⌘⏎)"
        on={() => editor.chain().focus().insertContent({ type: "pageBreakEmbed" }).run()}
      >
        ⤓ Sayfa sonu
      </Btn>
      <Btn
        title="Boşluk — buraya dikey boşluk ekle"
        on={() => editor.chain().focus().insertContent({ type: "spacerEmbed", attrs: { mm: 8 } }).run()}
      >
        ␣ Boşluk
      </Btn>
      <span className="mx-1 h-5 w-px bg-border" />
      <Btn title="Geri al (⌘Z)" on={() => editor.chain().focus().undo().run()}>
        ↶
      </Btn>
      <Btn title="Yinele (⌘⇧Z)" on={() => editor.chain().focus().redo().run()}>
        ↷
      </Btn>
    </div>
  );
}

export function ManuscriptEditor({
  value,
  onChange,
  media,
}: {
  value: string;
  onChange: (markdown: string) => void;
  /** Word'den gelen resimlerin ikili verisi (id → resim bloğu). Kartlarda
   *  küçük resim olarak gösterilir. */
  media?: MediaMap;
}) {
  // En son DIŞARI verilen markdown — dışarıdan gelen value bununla aynıysa
  // editöre dokunma (imleç zıplamasın); farklıysa (proje değişti) içeriği kur.
  const lastEmitted = useRef<string>(value);

  // Resim kartları için id → DATA URL. (object URL DEĞİL: StrictMode çifte-mount
  // ile revoke edilip resim kırılıyordu. Data URL revoke gerektirmez.) useMemo →
  // RENDER sırasında, setContent efektinden ÖNCE hazır; NodeView güncel URL'i okur.
  const mediaUrls = useRef<Map<string, string>>(new Map());
  const mediaKey = media ? [...media.keys()].join(",") : "";
  useMemo(() => {
    const next = new Map<string, string>();
    if (media) {
      for (const [id, blk] of media) {
        const ext = (blk.path.split(".").pop() || "png").toLowerCase();
        const mime =
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/png";
        next.set(id, `data:${mime};base64,${bytesToBase64(blk.data)}`);
      }
    }
    mediaUrls.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKey]);

  // Embed düğümlerini bir kez kur (getter ref'ten güncel URL'i okur).
  const imageEmbed = useMemo(() => createImageEmbed((id) => mediaUrls.current.get(id)), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Kitapta gerekmeyenleri sadeleştir (sonra eklenebilir).
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      imageEmbed,
      TableEmbed,
      PageBreakEmbed,
      SpacerEmbed,
    ],
    content: markdownToHtml(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-book focus:outline-none",
        spellcheck: "false",
      },
    },
    onUpdate: ({ editor }) => {
      const md = docToMarkdown(editor.getJSON());
      lastEmitted.current = md;
      onChange(md);
    },
  });

  // Dışarıdan içerik değişti (örn. başka proje yüklendi) → editörü güncelle.
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      editor.commands.setContent(markdownToHtml(value), { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <Toolbar editor={editor} />
      {/* "Masa" zemini — ortada beyaz kâğıt sayfa (kitabın içinde yazma hissi). */}
      <div className="flex-1 overflow-auto bg-[var(--background)] px-3 py-8 sm:px-6">
        <EditorContent editor={editor} />
      </div>
      <style>{`
        /* Yazma yüzeyi = beyaz KÂĞIT sayfa (koyu arayüzde bile kâğıt beyaz). */
        .tiptap-book { font-family: var(--font-serif, "Source Serif 4", Georgia, serif); font-size: 17px; line-height: 1.7; color: #1a1a1a; background: #fff; max-width: 660px; margin: 0 auto; padding: 60px 64px; border-radius: 2px; box-shadow: 0 6px 28px rgba(0,0,0,0.22); min-height: 880px; }
        .tiptap-book p { margin: 0 0 0.2em; text-indent: 1.6em; text-align: justify; }
        .tiptap-book p:first-child, .tiptap-book h1 + p, .tiptap-book h2 + p, .tiptap-book h3 + p { text-indent: 0; }
        .tiptap-book h1 { font-size: 1.7em; font-weight: 700; text-align: center; margin: 1.4em 0 0.6em; }
        .tiptap-book h2 { font-size: 1.3em; font-weight: 700; text-align: center; margin: 1.1em 0 0.4em; }
        .tiptap-book h3 { font-size: 1.1em; font-weight: 700; margin: 1em 0 0.3em; }
        .tiptap-book strong { font-weight: 700; }
        .tiptap-book em { font-style: italic; }
        .tiptap-book .tiptap-embed { margin: 1em auto; text-indent: 0; text-align: center; cursor: grab; }
        .tiptap-book .tiptap-image-embed img { max-width: 100%; max-height: 320px; border-radius: 4px; box-shadow: 0 1px 8px rgba(0,0,0,0.15); }
        .tiptap-book .tiptap-image-embed { color: #999; font-size: 14px; }
        .tiptap-book .tiptap-table-embed table { margin: 0 auto; border-collapse: collapse; font-size: 0.9em; color: #1a1a1a; }
        .tiptap-book .tiptap-table-embed td, .tiptap-book .tiptap-table-embed th { border: 1px solid #d8d8d8; padding: 4px 10px; text-align: left; }
        .tiptap-book .tiptap-table-embed th { font-weight: 700; background: #f3f3f1; }
        .tiptap-book .tiptap-pagebreak { margin: 1.2em auto; text-indent: 0; text-align: center; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #b08968; border-top: 2px dashed #d9c3ad; padding-top: 6px; cursor: pointer; }
        .tiptap-book .tiptap-spacer { margin: 0 auto; text-indent: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #bbb; background: repeating-linear-gradient(45deg, #f6f6f4, #f6f6f4 6px, #efefec 6px, #efefec 12px); border-radius: 3px; cursor: grab; }
        .tiptap-book .ProseMirror-selectednode { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
        .tiptap-book .is-editor-empty:first-child::before { content: attr(data-placeholder); color: #aaa; float: left; pointer-events: none; height: 0; }
      `}</style>
    </div>
  );
}
