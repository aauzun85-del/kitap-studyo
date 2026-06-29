"use client";

// Yazma görünümü — gerçek bir zengin-metin editörü (TipTap/ProseMirror). Enter
// yeni paragraf, serbest yazma, seç-kalın/italik, geri-al, Türkçe klavye hepsi
// motorun içinde. İçerik MARKDOWN olarak dışarı verilir (kayıt = manuscript.text).

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { markdownToHtml, docToMarkdown } from "./markdown";

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
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  // En son DIŞARI verilen markdown — dışarıdan gelen value bununla aynıysa
  // editöre dokunma (imleç zıplamasın); farklıysa (proje değişti) içeriği kur.
  const lastEmitted = useRef<string>(value);

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
      <div className="flex-1 overflow-auto px-8 py-6">
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .tiptap-book { font-family: var(--font-serif, "Source Serif 4", Georgia, serif); font-size: 17px; line-height: 1.7; color: var(--foreground); max-width: 62ch; margin: 0 auto; }
        .tiptap-book p { margin: 0 0 0.2em; text-indent: 1.6em; text-align: justify; }
        .tiptap-book p:first-child, .tiptap-book h1 + p, .tiptap-book h2 + p, .tiptap-book h3 + p { text-indent: 0; }
        .tiptap-book h1 { font-size: 1.7em; font-weight: 700; text-align: center; margin: 1.4em 0 0.6em; }
        .tiptap-book h2 { font-size: 1.3em; font-weight: 700; text-align: center; margin: 1.1em 0 0.4em; }
        .tiptap-book h3 { font-size: 1.1em; font-weight: 700; margin: 1em 0 0.3em; }
        .tiptap-book strong { font-weight: 700; }
        .tiptap-book em { font-style: italic; }
        .tiptap-book .is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--muted); float: left; pointer-events: none; height: 0; }
      `}</style>
    </div>
  );
}
