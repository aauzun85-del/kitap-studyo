// AI Editör istemlerine (editor-check/review/risk/genre) eklenen ortak dipnot
// kuralı. Metindeki dipnot biçimi: gövdede "kelime[^1]", tanım satırı "[^1]: …".

export const FOOTNOTE_PROMPT_RULE = [
  "DİPNOTLAR: Metindeki \"[^1]\", \"[^2]\" gibi işaretler dipnot başvurusudur;",
  "\"[^1]:\" ile başlayan satırlar o dipnotun metnidir. Bu işaretleri ve satır",
  "başlarını hata/noktalama sorunu olarak BİLDİRME, silme, numarasını değiştirme,",
  "yerini değiştirme. Alıntıladığın pasajda ve yazdığın her düzeltmede",
  "(suggestion/rewrite) işareti aynı kelimenin arkasında, birebir koru. Dipnot",
  "metninin kendisi gövde metni gibi incelenebilir.",
  "(Footnotes: \"[^1]\" marks are footnote references and lines starting with",
  "\"[^1]:\" are footnote texts. Never report, remove, renumber or move them; keep",
  "them unchanged in excerpts and in any suggestion/rewrite. The footnote text",
  "itself may be reviewed like body text.)",
].join("\n");

/** Alan açıklamalarına eklenen kısa hatırlatma. */
export const FOOTNOTE_FIELD_NOTE = " Metindeki [^1] gibi dipnot işaretlerini birebir koru.";
