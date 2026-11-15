"use client";

// AI Editör'ün yazma yüzeyi — beyaz bir kâğıt sayfa üstünde, kitap METNİNİN
// KENDİSİNİ düzenleyen editör (ProseMirror / TipTap).
//
// KAYIPSIZ TASARIM: belge = metnin satırları (her satır bir düğüm, biçim düğümü
// YOK). Kaydedilen metin = satırların "\n" ile birleşimi → ekranda ne varsa
// kayıtta (ve baskıda) birebir o. Hiçbir dönüştürme/çeviri yapılmaz; yıldız,
// alt çizgi, [[stil:…]], [[sayfa-sonu]], tablo blokları olduğu gibi kalır.
//
// GÖRÜNÜM: başlık ("# "), alıntı ("> "), kalın/italik (**…**, *…*) ve sayfa
// düzeni jetonları SÜSLEMELERLE (decoration) baskıdaki gibi gösterilir; işaret
// karakterleri soluk yazılır. Paragraf = boş satırla ayrılan blok (baskı motoru
// parseBlocks gibi); başlık/alıntı yalnız paragrafın İLK satırında geçerlidir.
// Kalın/italik baskı motorunun aynı ifadesiyle (INLINE_MARK_RE) bulunur.
//
// Enter = yeni paragraf (araya boş satır), Shift+Enter = ekranda alt satır
// (kitapta aynı paragraf içinde akar). Yapıştırılan düz metin satırlarıyla korunur.

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Extension, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Fragment, Slice, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { INLINE_MARK_RE } from "@/lib/layout/paginate";

/** Metinde işaretlenecek öneri. `id` = öneri dizini (kartla eşleşir). */
export type ManuscriptMark = { id: number; needle: string; kind: "fix" | "notice" };

/** Dışarıya verilen kumanda (araç çubuğu, Bul paneli, kartlar kullanır). */
export type ManuscriptApi = {
  editor: Editor;
  /** Önerinin metindeki yerine kaydırır. Bulunamazsa false. */
  reveal: (id: number) => boolean;
  /** Bir pasajı (ör. bölüm başlığı) bulup oraya kaydırır. */
  revealText: (needle: string) => boolean;
  /** Bul: eşleşmeleri işaretler, sayısını döner (büyük/küçük harf duyarsız). */
  find: (query: string) => number;
  /** Sonraki / önceki eşleşmeye git. */
  findStep: (dir: 1 | -1) => { index: number; total: number } | null;
  /** Tüm eşleşmeleri değiştirir (tek adımda geri alınabilir). Değişen sayısı. */
  replaceAll: (query: string, replacement: string) => number;
  clearFind: () => void;
};

export type BlockStyle = "paragraph" | "h1" | "h2" | "h3" | "h4" | "quote";

/** Araç çubuğunun gösterdiği anlık durum. */
export type ManuscriptState = {
  canUndo: boolean;
  canRedo: boolean;
  block: BlockStyle;
  bold: boolean;
  italic: boolean;
};

type Finder = (haystack: string, needle: string) => { at: number; len: number } | null;

const EXTERNAL = "ks-external";
const MARK_CLICK = "ks-mark-click";
const markKey = new PluginKey<DecorationSet>("ks-marks");
const findKey = new PluginKey<DecorationSet>("ks-find");
const styleKey = new PluginKey<DecorationSet>("ks-style");

// ── Metin ↔ belge (birebir) ────────────────────────────────────────────────
function lineJSON(text: string) {
  return text ? { type: "line", content: [{ type: "text", text }] } : { type: "line" };
}
function textToDocJSON(text: string) {
  return { type: "doc", content: text.replace(/\r\n?/g, "\n").split("\n").map(lineJSON) };
}
export function docToText(doc: PMNode): string {
  const lines: string[] = [];
  doc.forEach((line) => lines.push(line.textContent));
  return lines.join("\n");
}
function linesToNodes(schema: Schema, lines: string[]): PMNode[] {
  return lines.map((l) => schema.nodes.line.create(null, l ? schema.text(l) : null));
}
/** i. satırın belgedeki başlangıç konumu. */
function lineStart(doc: PMNode, i: number): number {
  let p = 0;
  for (let k = 0; k < i; k++) p += doc.child(k).nodeSize;
  return p;
}
/** Bir konumun bulunduğu satırın sırası. */
function lineIndexAt(doc: PMNode, pos: number): number {
  const $p = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  return Math.min($p.index(0), doc.childCount - 1);
}

// Belge şeması: doc > line+ ; line > text* (işaretsiz düz metin).
const KsDoc = Node.create({ name: "doc", topNode: true, content: "line+" });
const KsLine = Node.create({
  name: "line",
  content: "text*",
  marks: "",
  parseHTML() {
    return [{ tag: "p" }, { tag: "h1" }, { tag: "h2" }, { tag: "h3" }, { tag: "h4" }, { tag: "li" }, { tag: "div" }];
  },
  renderHTML() {
    return ["p", 0];
  },
});

// ── Satır sınıflandırması (baskı motorunun paragraf kuralları) ─────────────
const FMT_LINE = /^\[\[stil:[^\]]*\]\]$/;
const TOKEN_LINE = /^(\[\[sayfa-sonu\]\]|\[\[bosluk:[^\]]*\]\]|!\[[^\]]*\]\(kitap-gorsel:[^)]+\))$/;
const MARKER = /^(\s*)(#{1,4}\s+|>\s?)?/;

type LineKind = "blank" | "space" | "code" | "fmt" | "token" | "heading" | "quote" | "p";
type LineInfo = {
  index: number;
  start: number; // satır düğümünün konumu
  size: number;
  text: string;
  kind: LineKind;
  level: number; // başlık düzeyi (yalnız heading)
  first: number; // paragrafın ilk İÇERİK satırının sırası (yoksa kendisi)
};

/** [i0, i1) satırlarını sınıflar. i0 bir paragraf başı olmalı (0 ya da boş
 *  satırdan sonra) — bağlam boş satırda sıfırlanır (parseBlocks "\n\n" ile böler). */
function classifyLines(doc: PMNode, i0: number, i1: number): LineInfo[] {
  const out: LineInfo[] = [];
  let pos = lineStart(doc, i0);
  let chunkStart = true;
  let chunkKind: "p" | "quote" | "code" = "p";
  let first = -1;
  for (let i = i0; i < i1; i++) {
    const node = doc.child(i);
    const text = node.textContent;
    const trimmed = text.trim();
    const info: LineInfo = { index: i, start: pos, size: node.nodeSize, text, kind: "p", level: 0, first: i };
    pos += node.nodeSize;
    if (text === "") {
      info.kind = "blank";
      chunkStart = true;
      chunkKind = "p";
      first = -1;
    } else if (chunkKind === "code") {
      info.kind = "code";
      info.first = first;
      if (trimmed.startsWith("```")) chunkKind = "p";
    } else if (!trimmed) {
      info.kind = "space"; // yalnız boşluk: paragrafı bölmez (baskıda da)
      info.first = first < 0 ? i : first;
    } else if (chunkStart && trimmed.startsWith("```kitap-tablo")) {
      info.kind = "code";
      chunkKind = trimmed.length > 15 && trimmed.endsWith("```") ? "p" : "code";
      chunkStart = false;
      first = i;
    } else if (chunkStart && FMT_LINE.test(trimmed)) {
      info.kind = "fmt"; // biçim satırı: sonraki satır hâlâ paragraf başı
    } else if (chunkStart && TOKEN_LINE.test(trimmed)) {
      info.kind = "token";
      chunkStart = false;
      first = i;
    } else {
      if (chunkStart) {
        first = i;
        const h = /^\s*(#{1,4})\s+/.exec(text);
        if (h) {
          info.kind = "heading";
          info.level = h[1].length;
          chunkKind = "p";
        } else chunkKind = trimmed.startsWith(">") ? "quote" : "p";
      }
      if (info.kind !== "heading") info.kind = chunkKind === "quote" ? "quote" : "p";
      info.first = first;
      chunkStart = false;
    }
    out.push(info);
  }
  return out;
}

/** Bir satırın paragrafının başladığı satır (boş satırdan sonraki). */
function chunkFreshStart(doc: PMNode, i: number): number {
  let k = i;
  while (k > 0 && doc.child(k - 1).textContent !== "") k--;
  return k;
}

/** Satır içi kalın/italik eşleşmeleri (satır ofsetleriyle). */
type InlineHit = { start: number; end: number; mark: 1 | 2 | 3 };
function inlineHits(text: string): InlineHit[] {
  const out: InlineHit[] = [];
  const re = new RegExp(INLINE_MARK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const mark = m[2] !== undefined ? 3 : m[3] !== undefined || m[4] !== undefined ? 2 : 1;
    out.push({ start: m.index, end: m.index + m[0].length, mark });
  }
  return out;
}

function decorateLines(infos: LineInfo[]): Decoration[] {
  const decos: Decoration[] = [];
  for (const L of infos) {
    const from = L.start;
    const to = L.start + L.size;
    const node = (cls: string) => decos.push(Decoration.node(from, to, { class: cls }));
    const mk = (a: number, b: number) => {
      if (b > a) decos.push(Decoration.inline(from + 1 + a, from + 1 + b, { class: "ks-mk" }));
    };
    if (L.kind === "blank") {
      node("ks-blank");
      continue;
    }
    if (L.kind === "code") {
      node("ks-code");
      continue;
    }
    if (L.kind === "fmt") {
      node("ks-fmt");
      continue;
    }
    if (L.kind === "token") {
      node(L.text.trim().startsWith("[[sayfa-sonu") ? "ks-tok ks-break" : "ks-tok");
      continue;
    }
    if (L.kind === "space") continue;
    let body = 0;
    if (L.kind === "heading") {
      node(`ks-h${L.level}`);
      const h = /^\s*#{1,4}\s+/.exec(L.text);
      if (h) {
        mk(0, h[0].length);
        body = h[0].length;
      }
    } else if (L.kind === "quote") {
      node("ks-quote");
      const q = /^\s*>\s?/.exec(L.text);
      if (q) {
        mk(0, q[0].length);
        body = q[0].length;
      }
    }
    for (const h of inlineHits(L.text.slice(body))) {
      const a = body + h.start;
      const b = body + h.end;
      const cls = h.mark === 3 ? "ks-b ks-i" : h.mark === 2 ? "ks-b" : "ks-i";
      mk(a, a + h.mark);
      decos.push(Decoration.inline(from + 1 + a + h.mark, from + 1 + b - h.mark, { class: cls }));
      mk(b - h.mark, b);
    }
  }
  return decos;
}

// Görünüm süslemeleri ARTIMLI: yalnız değişen paragraf(lar) yeniden hesaplanır
// (200 bin karakterlik kitapta da tuş vuruşu takılmasın).
const stylePlugin = new Plugin<DecorationSet>({
  key: styleKey,
  state: {
    init: (_, state) => DecorationSet.create(state.doc, decorateLines(classifyLines(state.doc, 0, state.doc.childCount))),
    apply: (tr, set, oldState, newState) => {
      if (!tr.docChanged) return set;
      const doc = newState.doc;
      const start = oldState.doc.content.findDiffStart(doc.content);
      if (start == null) return set.map(tr.mapping, doc);
      const end = oldState.doc.content.findDiffEnd(doc.content);
      const endB = end ? Math.max(end.b, start) : doc.content.size;
      // Pencere: değişikliğin paragrafının başından, sonraki boş satıra kadar.
      const i0 = chunkFreshStart(doc, lineIndexAt(doc, start));
      let i1 = lineIndexAt(doc, endB) + 1;
      while (i1 < doc.childCount && doc.child(i1 - 1).textContent !== "") i1++;
      i1 = Math.min(i1, doc.childCount);
      const winFrom = lineStart(doc, i0);
      const winTo = lineStart(doc, i1);
      const mapped = set.map(tr.mapping, doc);
      const stale = winTo > winFrom ? mapped.find(winFrom + 1, winTo - 1) : [];
      return mapped.remove(stale).add(doc, decorateLines(classifyLines(doc, i0, i1)));
    },
  },
  props: {
    decorations(state) {
      return styleKey.getState(state);
    },
  },
});

// Belgenin düz metni + her karakterin belgedeki konumu (arama/işaret için).
// Satırlar "\n" ile ayrılır (konum -1) → metin, kaydedilen metnin aynısıdır.
type DocIndex = { text: string; map: number[] };
function buildIndex(doc: PMNode): DocIndex {
  let text = "";
  const map: number[] = [];
  let pos = 0;
  let firstLine = true;
  doc.forEach((line) => {
    if (!firstLine) {
      text += "\n";
      map.push(-1);
    }
    firstLine = false;
    const s = line.textContent;
    for (let i = 0; i < s.length; i++) map.push(pos + 1 + i);
    text += s;
    pos += line.nodeSize;
  });
  return { text, map };
}

function locate(idx: DocIndex, needle: string, finder: Finder): { from: number; to: number } | null {
  const n = needle.trim();
  if (!n) return null;
  const hit = finder(idx.text, n);
  if (!hit || hit.len === 0) return null;
  let a = hit.at;
  let b = hit.at + hit.len - 1;
  while (a <= b && idx.map[a] === -1) a++;
  while (b >= a && idx.map[b] === -1) b--;
  if (a > b) return null;
  return { from: idx.map[a], to: idx.map[b] + 1 };
}

function markDeco(from: number, to: number, m: ManuscriptMark, active: boolean): Decoration {
  return Decoration.inline(
    from,
    to,
    { class: `${m.kind === "fix" ? "ks-fix" : "ks-note"}${active ? " ks-active" : ""}`, "data-mark": String(m.id) },
    { id: m.id, needle: m.needle, kind: m.kind, active },
  );
}

function decoPlugin(key: PluginKey<DecorationSet>, clickable = false) {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        const next = tr.getMeta(key) as DecorationSet | undefined;
        if (next) return next;
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
      },
    },
    props: {
      decorations(state) {
        return key.getState(state);
      },
      // İşarete tıklama editör DOM'una özel olay olarak duyurulur (bileşen
      // bir efektte dinler) → eklenti React ref'lerine dokunmaz.
      handleClick: clickable
        ? (view, pos) => {
            const hit = key.getState(view.state)?.find(pos, pos);
            if (hit && hit.length) view.dom.dispatchEvent(new CustomEvent(MARK_CLICK, { detail: hit[0].spec.id as number }));
            return false;
          }
        : undefined,
    },
  });
}

// ── Satır işlemleri (araç çubuğu + kısayollar) ─────────────────────────────
/** İmlecin satırı (⌘A gibi belge düzeyi seçimde de güvenli). */
function currentInfo(state: EditorState): LineInfo {
  const doc = state.doc;
  const i = lineIndexAt(doc, state.selection.from);
  const i0 = chunkFreshStart(doc, i);
  const infos = classifyLines(doc, i0, i + 1);
  return infos[infos.length - 1];
}

function styleOf(info: LineInfo): BlockStyle {
  if (info.kind === "heading") return `h${info.level}` as BlockStyle;
  if (info.kind === "quote") return "quote";
  // Paragrafın ilk satırı başlıksa, devam satırı da o paragrafın parçasıdır.
  return "paragraph";
}

type TextOp = { pos: number; del: number; ins: string } | { pos: number; blankLine: true };

/** Paragraf stilini değiştirir: önek YALNIZ paragrafın ilk satırına yazılır
 *  (baskı motoru başlığı/alıntıyı ilk satırdan okur). Tablo, jeton ve biçim
 *  satırlarına dokunulmaz; satır başındaki girinti korunur. */
export function setBlockStyle(editor: Editor, style: BlockStyle) {
  const { state } = editor;
  const doc = state.doc;
  const { from, to } = state.selection;
  const ia = lineIndexAt(doc, from);
  const ib = Math.max(ia, lineIndexAt(doc, to > from ? to - 1 : to));
  const infos = classifyLines(doc, chunkFreshStart(doc, ia), Math.min(doc.childCount, ib + 1));
  const byIndex = new Map(infos.map((x) => [x.index, x]));
  // Paragrafın tüm satırları (devam satırlarındaki "> " temizliği için).
  const chunkLines = (first: number): LineInfo[] => {
    const all = classifyLines(doc, chunkFreshStart(doc, first), doc.childCount);
    return all.filter((x) => x.first === first && (x.kind === "p" || x.kind === "quote" || x.kind === "heading"));
  };
  const content = (x: LineInfo | undefined) => !!x && (x.kind === "p" || x.kind === "quote" || x.kind === "heading");
  const targets = infos.filter((x) => x.index >= ia && x.index <= ib && content(x));
  if (!targets.length) return;
  const prefix =
    style === "h1" ? "# " : style === "h2" ? "## " : style === "h3" ? "### " : style === "h4" ? "#### " : style === "quote" ? "> " : "";
  const ops: TextOp[] = [];
  const markerOp = (x: LineInfo, ins: string) => {
    const m = MARKER.exec(x.text);
    const ws = m?.[1].length ?? 0;
    const old = m?.[2]?.length ?? 0;
    if (old || ins) ops.push({ pos: x.start + 1 + ws, del: old, ins });
  };
  const done = new Set<number>();
  // Tek satırlık işlemde, paragrafın ortasındaki satıra BAŞLIK verilirse o satır
  // kendi paragrafı olur (önüne boş satır) — yoksa baskıda başlık sayılmaz.
  const single = targets.length === 1 && targets[0].index !== targets[0].first;
  for (const x of targets) {
    if (single && style !== "quote" && style !== "paragraph") {
      ops.push({ pos: x.start, blankLine: true });
      markerOp(x, prefix);
      break;
    }
    if (done.has(x.first)) continue;
    done.add(x.first);
    const firstInfo = byIndex.get(x.first) ?? classifyLines(doc, chunkFreshStart(doc, x.first), x.first + 1).pop();
    if (!firstInfo || !content(firstInfo)) continue;
    markerOp(firstInfo, prefix);
    if (style !== "quote") {
      // Alıntıdan çıkınca devam satırlarındaki "> " işaretleri de kalksın.
      for (const y of chunkLines(x.first)) {
        if (y.index !== x.first && /^\s*>/.test(y.text)) markerOp(y, "");
      }
    }
  }
  if (!ops.length) return;
  ops.sort((a, b) => b.pos - a.pos);
  const tr = state.tr;
  for (const op of ops) {
    if ("blankLine" in op) tr.insert(op.pos, state.schema.nodes.line.create());
    else if (op.ins) tr.insertText(op.ins, op.pos, op.pos + op.del);
    else tr.delete(op.pos, op.pos + op.del);
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

/** Kalın (**) / italik (*) aç-kapa. Seçim yoksa imlecin kelimesine uygulanır.
 *  İmleç zaten biçimli bir ifadenin içindeyse o biçim kaldırılır/eklenir
 *  (***kalın italik*** dahil) → işaretler asla iç içe birikmez. */
export function toggleInline(editor: Editor, mark: "**" | "*") {
  const { state } = editor;
  const doc = state.doc;
  const { from, to } = state.selection;
  const i = lineIndexAt(doc, from);
  if (lineIndexAt(doc, to) !== i) return; // birden çok satır: dokunma
  const start = lineStart(doc, i);
  const base = start + 1;
  const text = doc.child(i).textContent;
  let a = Math.max(0, from - base);
  let z = Math.max(a, Math.min(text.length, to - base));
  const want = mark === "**" ? 2 : 1;
  const tr = state.tr;
  const hit = inlineHits(text).find((h) => a >= h.start && z <= h.end);
  if (hit) {
    const has = hit.mark === 3 || hit.mark === want;
    if (has) {
      // Bu biçimi kaldır: ***x*** → *x* (kalın kalkar) ya da **x** (italik kalkar).
      const k = want;
      tr.delete(base + hit.end - k, base + hit.end).delete(base + hit.start, base + hit.start + k);
    } else {
      // Diğer biçimin dışına ekle: *x* + kalın → ***x***, **x** + italik → ***x***.
      tr.insertText(mark, base + hit.end).insertText(mark, base + hit.start);
    }
    editor.view.dispatch(tr);
    editor.view.focus();
    return;
  }
  if (a === z) {
    // Seçim yok → imlecin üstündeki kelime (Word'deki gibi).
    const isW = (ch: string | undefined) => !!ch && /[\p{L}\p{N}'’-]/u.test(ch);
    while (a > 0 && isW(text[a - 1])) a--;
    while (z < text.length && isW(text[z])) z++;
  }
  if (a === z) {
    tr.insertText(mark + mark, base + a);
    tr.setSelection(TextSelection.create(tr.doc, base + a + mark.length));
  } else {
    // Seçimin kenarındaki boşluklar işaretin DIŞINDA kalmalı (baskı kuralı).
    const sel = text.slice(a, z);
    if (!sel.trim()) return;
    const lead = sel.length - sel.trimStart().length;
    const trail = sel.length - sel.trimEnd().length;
    tr.insertText(mark, base + z - trail);
    tr.insertText(mark, base + a + lead);
    tr.setSelection(TextSelection.create(tr.doc, base + a + lead + mark.length, base + z - trail + mark.length));
  }
  editor.view.dispatch(tr);
  editor.view.focus();
}

/** İmlecin paragrafından sonra ayrı bir jeton satırı ekler (tablonun içine değil). */
export function insertTokenLine(editor: Editor, token: string) {
  const { state } = editor;
  const doc = state.doc;
  let i = lineIndexAt(doc, state.selection.from);
  const info = currentInfo(state);
  if (info.kind === "code") {
    // Tablo bloğunun içindeysek kapanış satırının sonrasına ekle.
    const rest = classifyLines(doc, chunkFreshStart(doc, i), doc.childCount);
    const after = rest.filter((x) => x.index >= i);
    const close = after.find((x) => x.kind === "code" && x.index > info.first && x.text.trim().startsWith("```"));
    i = close ? close.index : (after.find((x) => x.kind !== "code")?.index ?? doc.childCount) - 1;
  }
  const end = lineStart(doc, i) + doc.child(i).nodeSize;
  const nodes = linesToNodes(state.schema, ["", token, "", ""]);
  const tr = state.tr.insert(end, Fragment.from(nodes));
  const caret = end + nodes.slice(0, 3).reduce((s, x) => s + x.nodeSize, 0) + 1;
  tr.setSelection(TextSelection.create(tr.doc, caret));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

function readState(editor: Editor): ManuscriptState {
  const { state } = editor;
  const info = currentInfo(state);
  const base = info.start + 1;
  const a = Math.max(0, state.selection.from - base);
  const z = Math.max(a, Math.min(info.text.length, state.selection.to - base));
  const hit = inlineHits(info.text).find((h) => a > h.start && z < h.end);
  return {
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    block: styleOf(info),
    bold: !!hit && (hit.mark === 2 || hit.mark === 3),
    italic: !!hit && (hit.mark === 1 || hit.mark === 3),
  };
}

// Klavye: Enter = yeni paragraf (boş satır + satır), Shift+Enter = yeni satır.
const KsKeys = Extension.create({
  name: "ksKeys",
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const info = currentInfo(state);
        const tr = state.tr.deleteSelection();
        tr.split(tr.selection.from);
        // Boş satırdayken tek satır yeter (art arda boş satır birikmesin).
        if (info.text !== "") tr.split(tr.selection.from);
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
      "Shift-Enter": ({ editor }) => {
        const tr = editor.state.tr.deleteSelection();
        tr.split(tr.selection.from);
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
      "Mod-b": ({ editor }) => {
        toggleInline(editor, "**");
        return true;
      },
      "Mod-i": ({ editor }) => {
        toggleInline(editor, "*");
        return true;
      },
      "Mod-Enter": ({ editor }) => {
        insertTokenLine(editor, "[[sayfa-sonu]]");
        return true;
      },
    };
  },
});

// Yapıştırma: düz metin SATIRLARIYLA korunur. DIŞARIDAN gelen metinde hiç boş
// satır yoksa (Word'den kopyalanan paragraflar gibi) her satır ayrı paragraftır
// → araya boş satır konur (baskı motoru da böyle metinde her satırı paragraf
// sayar). Editörün kendi içinden kes/yapıştır ise birebir korunur.
function pastedSlice(schema: Schema, text: string, internal: boolean): Slice {
  let lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (!internal) {
    const core = text.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
    if (core.includes("\n") && !/\n[ \t]*\n/.test(core)) {
      lines = lines.flatMap((l, i) => (i === 0 || l === "" || lines[i - 1] === "" ? [l] : ["", l]));
    }
  }
  return new Slice(Fragment.from(linesToNodes(schema, lines)), 1, 1);
}

export function ManuscriptEditor({
  value,
  onChange,
  marks,
  activeMark,
  onMarkClick,
  finder,
  onReady,
  onState,
  fontPx = 18,
  fontFamily = "Merriweather",
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  marks: ManuscriptMark[];
  activeMark: number | null;
  onMarkClick?: (id: number) => void;
  /** Karakter farklarına toleranslı arama (tırnak, tire, üç nokta, boşluk). */
  finder: Finder;
  onReady?: (api: ManuscriptApi | null) => void;
  onState?: (s: ManuscriptState) => void;
  /** Ekran yazı boyutu (yalnız ekranda; kitaba etki etmez). */
  fontPx?: number;
  /** Ekran yazı tipi (yalnız ekranda). */
  fontFamily?: string;
  placeholder?: string;
}) {
  // En son DIŞARI verilen metin — dışarıdan gelen value bununla aynıysa
  // editöre dokunma; farklıysa yalnız değişen satırları güncelle.
  const lastEmitted = useRef<string>(value);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [initialContent] = useState(() => textToDocJSON(value));

  // Geri çağrılar ref'te: editör bir kez kurulur, en güncel işlevleri okur.
  const cb = useRef({ onChange, onMarkClick, onState, finder });
  useLayoutEffect(() => {
    cb.current = { onChange, onMarkClick, onState, finder };
  });

  const extensions = useMemo(
    () => [
      // Yalnız düz metin + geri al / yinele + sürükle imleci; biçim düğümü yok.
      StarterKit.configure({
        document: false,
        paragraph: false,
        heading: false,
        blockquote: false,
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        link: false,
        hardBreak: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        trailingNode: false,
      }),
      KsDoc,
      KsLine,
      KsKeys,
      Extension.create({
        name: "ksDecorations",
        addProseMirrorPlugins() {
          return [stylePlugin, decoPlugin(markKey, true), decoPlugin(findKey)];
        },
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-book focus:outline-none",
        spellcheck: "false",
        ...(placeholder ? { "aria-label": placeholder } : {}),
      },
      // Yapıştırılan her şey düz metin olarak, satırlarıyla alınır (biçim düğümü yok).
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (!text) return false;
        const internal = (event.clipboardData?.getData("text/html") ?? "").includes("data-pm-slice");
        view.dispatch(view.state.tr.replaceSelection(pastedSlice(view.state.schema, text, internal)).scrollIntoView());
        return true;
      },
      clipboardTextParser: (text, _ctx, _plain, view) => pastedSlice(view.state.schema, text, false),
      // Kopyalanan metin, satırları "\n" ile (boş satırlar dahil) birebir.
      clipboardTextSerializer: (slice) => {
        const lines: string[] = [];
        slice.content.forEach((n) => lines.push(n.textContent));
        return lines.join("\n");
      },
    },
    onUpdate: ({ editor, transaction }) => {
      if (transaction.getMeta(EXTERNAL)) return;
      const text = docToText(editor.state.doc);
      lastEmitted.current = text;
      cb.current.onChange(text);
    },
    onTransaction: ({ editor }) => {
      cb.current.onState?.(readState(editor));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onClick = (e: Event) => cb.current.onMarkClick?.((e as CustomEvent<number>).detail);
    dom.addEventListener(MARK_CLICK, onClick);
    return () => dom.removeEventListener(MARK_CLICK, onClick);
  }, [editor]);

  // ── Öneri işaretleri ──
  const notFound = useRef(new Set<string>());
  const marksRef = useRef({ marks, activeMark });
  useLayoutEffect(() => {
    marksRef.current = { marks, activeMark };
  });

  const syncMarks = useMemo(
    () => (ed: Editor, force: boolean) => {
      if (ed.isDestroyed) return;
      const { marks: list, activeMark: active } = marksRef.current;
      const state = ed.view.state;
      let set = markKey.getState(state) ?? DecorationSet.empty;
      if (force) notFound.current.clear();
      const desired = new Map(list.map((m) => [m.id, m]));
      const keep = new Set<number>();
      const remove: Decoration[] = [];
      const add: Decoration[] = [];
      for (const d of set.find()) {
        const m = desired.get(d.spec.id as number);
        const isActive = d.spec.id === active;
        if (m && m.needle === d.spec.needle && m.kind === d.spec.kind && d.spec.active === isActive && !keep.has(m.id)) {
          keep.add(m.id);
          continue;
        }
        remove.push(d);
        // Yalnız "seçili" durumu değiştiyse aynı yerde yeniden kur (arama yok).
        if (m && m.needle === d.spec.needle && !keep.has(m.id)) {
          add.push(markDeco(d.from, d.to, m, isActive));
          keep.add(m.id);
        }
      }
      const missing = list.filter((m) => !keep.has(m.id) && !notFound.current.has(`${m.id}\u0000${m.needle}`));
      if (missing.length) {
        const idx = buildIndex(state.doc);
        for (const m of missing) {
          const hit = locate(idx, m.needle, cb.current.finder);
          if (hit) add.push(markDeco(hit.from, hit.to, m, m.id === active));
          else notFound.current.add(`${m.id}\u0000${m.needle}`);
        }
      }
      if (!remove.length && !add.length) return;
      set = set.remove(remove).add(state.doc, add);
      ed.view.dispatch(state.tr.setMeta(markKey, set).setMeta("addToHistory", false));
    },
    [],
  );

  useEffect(() => {
    if (editor) syncMarks(editor, false);
  }, [editor, marks, activeMark, syncMarks]);

  // ── Dışarıdan metin değişti → yalnız farklı satırları değiştir ──
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === lastEmitted.current) return;
    lastEmitted.current = value;
    const doc = editor.state.doc;
    const oldLines: string[] = [];
    doc.forEach((l) => oldLines.push(l.textContent));
    const newLines = value.replace(/\r\n?/g, "\n").split("\n");
    let start = 0;
    const min = Math.min(oldLines.length, newLines.length);
    while (start < min && oldLines[start] === newLines[start]) start++;
    let endA = oldLines.length;
    let endB = newLines.length;
    while (endA > start && endB > start && oldLines[endA - 1] === newLines[endB - 1]) {
      endA--;
      endB--;
    }
    if (start !== endA || start !== endB) {
      const from = lineStart(doc, start);
      let to = from;
      for (let k = start; k < endA; k++) to += doc.child(k).nodeSize;
      const nodes = linesToNodes(editor.schema, newLines.slice(start, endB));
      const tr = editor.state.tr;
      if (nodes.length) tr.replaceWith(from, to, nodes);
      else tr.delete(from, to); // en az bir satır her zaman kalır (split en az 1 öğe döner)
      tr.setMeta(EXTERNAL, true).setMeta("addToHistory", false);
      editor.view.dispatch(tr);
    }
    syncMarks(editor, true);
  }, [value, editor, syncMarks]);

  // ── Kumanda (API) ──
  const findState = useRef<{ query: string; doc: PMNode | null; hits: { from: number; to: number }[]; cur: number }>({
    query: "",
    doc: null,
    hits: [],
    cur: -1,
  });

  useEffect(() => {
    if (!editor) return;
    const alive = () => !editor.isDestroyed;
    const scrollTo = (pos: number) => {
      const box = scrollRef.current;
      if (!box || !alive()) return;
      // Dar ekranda sayfa tek parça kayar: editör kutusu görünmüyorsa önce onu getir.
      const outer = box.getBoundingClientRect();
      if (outer.top < 0 || outer.top > window.innerHeight * 0.6) box.scrollIntoView({ block: "start", behavior: "smooth" });
      try {
        const c = editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size));
        const r = box.getBoundingClientRect();
        box.scrollTo({ top: box.scrollTop + c.top - r.top - box.clientHeight * 0.3, behavior: "smooth" });
      } catch {
        /* konum çözülemedi */
      }
    };
    const computeHits = (query: string) => {
      const q = query.trim();
      const hits: { from: number; to: number }[] = [];
      if (q) {
        const idx = buildIndex(editor.state.doc);
        const hay = idx.text.toLocaleLowerCase("tr");
        const needle = q.toLocaleLowerCase("tr");
        // Küçük harfe çevirme harf sayısını değiştirmediyse konumlar güvenilir.
        if (hay.length === idx.text.length) {
          let at = hay.indexOf(needle);
          while (at !== -1 && hits.length < 5000) {
            const a = idx.map[at];
            const b = idx.map[at + needle.length - 1];
            if (a >= 0 && b >= 0) hits.push({ from: a, to: b + 1 });
            at = hay.indexOf(needle, at + Math.max(1, needle.length));
          }
        }
      }
      findState.current = { query: q, doc: editor.state.doc, hits, cur: -1 };
    };
    const paintFind = () => {
      if (!alive()) return;
      const { hits, cur } = findState.current;
      const decos = hits.map((h, i) => Decoration.inline(h.from, h.to, { class: i === cur ? "ks-find ks-find-cur" : "ks-find" }));
      const set = DecorationSet.create(editor.state.doc, decos);
      editor.view.dispatch(editor.state.tr.setMeta(findKey, set).setMeta("addToHistory", false));
    };
    const api: ManuscriptApi = {
      editor,
      reveal: (id) => {
        if (!alive()) return false;
        const d = markKey.getState(editor.state)?.find(undefined, undefined, (s) => s.id === id)[0];
        if (!d) return false;
        scrollTo(d.from);
        return true;
      },
      revealText: (needle) => {
        if (!alive()) return false;
        const hit = locate(buildIndex(editor.state.doc), needle, cb.current.finder);
        if (!hit) return false;
        scrollTo(hit.from);
        editor.commands.setTextSelection(hit.from);
        return true;
      },
      find: (query) => {
        if (!alive()) return 0;
        computeHits(query);
        paintFind();
        return findState.current.hits.length;
      },
      findStep: (dir) => {
        if (!alive()) return null;
        const fs = findState.current;
        if (fs.doc !== editor.state.doc) computeHits(fs.query);
        const { hits } = findState.current;
        if (!hits.length) {
          paintFind();
          return null;
        }
        const cur = findState.current.cur;
        const nextIdx = cur < 0 ? (dir === 1 ? 0 : hits.length - 1) : (cur + dir + hits.length) % hits.length;
        findState.current.cur = nextIdx;
        paintFind();
        const h = hits[nextIdx];
        editor.commands.setTextSelection({ from: h.from, to: h.to });
        scrollTo(h.from);
        return { index: nextIdx, total: hits.length };
      },
      replaceAll: (query, replacement) => {
        if (!alive()) return 0;
        computeHits(query);
        const { hits } = findState.current;
        if (!hits.length) return 0;
        const tr: Transaction = editor.state.tr;
        // Sondan başa: öndeki değişiklikler sonrakilerin konumunu kaydırmasın.
        for (let i = hits.length - 1; i >= 0; i--) {
          const h = hits[i];
          if (replacement) tr.insertText(replacement, h.from, h.to);
          else tr.delete(h.from, h.to);
        }
        editor.view.dispatch(tr);
        computeHits(query);
        paintFind();
        return hits.length;
      },
      clearFind: () => {
        findState.current = { query: "", doc: null, hits: [], cur: -1 };
        if (alive()) editor.view.dispatch(editor.state.tr.setMeta(findKey, DecorationSet.empty).setMeta("addToHistory", false));
      },
    };
    onReady?.(api);
    return () => onReady?.(null);
    // onReady üst bileşende sabit (setState); editör değişince yeniden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div
      ref={scrollRef}
      className="ks-desk h-full overflow-y-auto px-2 py-4 sm:px-6 sm:py-6"
      style={{ ["--ks-font" as string]: `${fontPx}px`, ["--ks-family" as string]: `"${fontFamily}"` }}
    >
      {editor ? <EditorContent editor={editor} /> : <div className="tiptap-book" aria-busy="true" />}
      <style>{`
        /* Yazma yüzeyi = beyaz KÂĞIT sayfa (koyu arayüzde bile kâğıt beyaz). */
        .tiptap-book { font-family: var(--ks-family), Georgia, serif; font-size: var(--ks-font, 18px); line-height: 1.75; color: #1f1f24; background: #fff; max-width: 820px; margin: 0 auto; padding: clamp(28px, 6%, 64px) clamp(20px, 8%, 80px) 96px; border-radius: 14px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(15,15,40,0.06), 0 8px 28px rgba(15,15,40,0.07); min-height: 70vh; white-space: pre-wrap; word-wrap: break-word; }
        .tiptap-book p { margin: 0; }
        .tiptap-book .ks-blank { line-height: 0.85; }
        .tiptap-book .ks-mk { color: #b8b3cc; font-weight: 400; font-style: normal; }
        .tiptap-book .ks-b { font-weight: 700; }
        .tiptap-book .ks-i { font-style: italic; }
        .tiptap-book .ks-h1 { font-size: 1.85em; font-weight: 700; line-height: 1.3; margin: 0.25em 0 0.35em; padding-bottom: 0.4em; position: relative; }
        .tiptap-book .ks-h1::after { content: ""; position: absolute; left: 0; bottom: 0; width: 56px; height: 3px; border-radius: 2px; background: var(--color-accent, #4f46e5); }
        .tiptap-book .ks-h1 .ks-mk, .tiptap-book .ks-h2 .ks-mk, .tiptap-book .ks-h3 .ks-mk, .tiptap-book .ks-h4 .ks-mk { font-size: 0.55em; vertical-align: middle; }
        .tiptap-book .ks-h2 { font-size: 1.4em; font-weight: 600; font-style: italic; line-height: 1.35; margin: 0.3em 0 0.2em; }
        .tiptap-book .ks-h3 { font-size: 1.15em; font-weight: 700; }
        .tiptap-book .ks-h4 { font-weight: 700; }
        .tiptap-book .ks-quote { padding-left: 1.1em; border-left: 3px solid #d9d4f5; font-style: italic; color: #34343c; }
        .tiptap-book .ks-fmt, .tiptap-book .ks-tok, .tiptap-book .ks-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.7em; line-height: 1.9; color: #9a8f7f; }
        .tiptap-book .ks-break { text-align: center; letter-spacing: 0.12em; color: #b08968; border-top: 2px dashed #d9c3ad; margin-top: 0.6em; padding-top: 0.2em; }
        .tiptap-book .ks-code { color: #8a8aa0; background: #f6f6f9; padding: 0 0.6em; }
        .tiptap-book .ks-fix { text-decoration: underline wavy #e11d48; text-decoration-thickness: 1.5px; text-underline-offset: 4px; text-decoration-skip-ink: none; cursor: pointer; }
        .tiptap-book .ks-note { background: #fdf0c4; border-radius: 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; cursor: pointer; }
        .tiptap-book .ks-active { background: #ece7ff; box-shadow: 0 0 0 2px #ece7ff; border-radius: 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
        .tiptap-book .ks-find { background: #fde68a; border-radius: 2px; }
        .tiptap-book .ks-find-cur { background: #f59e0b; color: #fff; }
      `}</style>
    </div>
  );
}
