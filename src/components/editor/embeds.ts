// Yazma editöründe (TipTap) Word'den gelen RESİM ve TABLO'yu "kart" olarak
// gösteren özel atom düğümleri. Editör markdown düzenler; markdown.ts bu kartları
// jetona (resim) / ```kitap-tablo fence'ine (tablo) çevirir, geri okur.
//
// Atom (içi düzenlenemez) + draggable → kullanıcı kartı taşıyıp silebilir, ama
// içeriği (resmin pikselleri / tablonun verisi) bozulmaz; nihai PDF'te aynen yer alır.

import { Node, mergeAttributes } from "@tiptap/core";

// Resim kartı. attrs.id → LayoutStudio'daki medya haritasındaki ikili veri.
// getMediaUrl ile id → object URL (küçük resim) çözülür (yoksa "Görsel" yazısı).
export function createImageEmbed(getMediaUrl: (id: string) => string | undefined) {
  return Node.create({
    name: "imageEmbed",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
      // id ↔ data-id (varsayılan eşleme HTML id="..." okur → data-id'yi kaçırırdı).
      return {
        id: {
          default: null,
          parseHTML: (el) => el.getAttribute("data-id"),
          renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
        },
      };
    },
    parseHTML() {
      return [{ tag: "div[data-image-embed]" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-image-embed": "" })];
    },
    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement("figure");
        dom.className = "tiptap-embed tiptap-image-embed";
        dom.setAttribute("contenteditable", "false");
        const id: string = node.attrs.id ?? "";
        const url = getMediaUrl(id);
        if (url) {
          const img = document.createElement("img");
          img.src = url;
          img.alt = "Görsel";
          dom.appendChild(img);
        } else {
          dom.appendChild(document.createTextNode("🖼️  Görsel"));
        }
        return { dom };
      };
    },
  });
}

type Run = { text: string; bold?: boolean; italic?: boolean };

// Tablo kartı. attrs.json → {columns, rows:Run[][][]} (markdown'a kalıcı yazılır).
export const TableEmbed = Node.create({
  name: "tableEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    // json ↔ data-json.
    return {
      json: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-json") ?? "",
        renderHTML: (attrs) => (attrs.json ? { "data-json": attrs.json } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-table-embed]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-table-embed": "" })];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "tiptap-embed tiptap-table-embed";
      dom.setAttribute("contenteditable", "false");
      try {
        const t = JSON.parse(node.attrs.json) as { columns: number; rows: Run[][][] };
        const table = document.createElement("table");
        t.rows.forEach((row, ri) => {
          const tr = document.createElement("tr");
          row.forEach((cell) => {
            const td = document.createElement(ri === 0 ? "th" : "td");
            td.textContent = cell.map((r) => r.text).join("");
            tr.appendChild(td);
          });
          table.appendChild(tr);
        });
        dom.appendChild(table);
      } catch {
        dom.textContent = "▦  Tablo";
      }
      return { dom };
    };
  },
});
