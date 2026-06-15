// Gold Translation Lab'den damıtılmış üslup/akıcılık kuralları (editor_rules_v1).
// Editöryal inceleme bu kuralları sistem komutuna gömerek kullanır.
// "translation" kapsamlı kurallar yazara uygulanmaz; "meta" kurallar (örn.
// texture_calibration) aday üretmez, motora kalibrasyon talimatıdır.
import rulesData from "./editor_rules_v1.json";

export type RuleScope = "author" | "translation" | "both";
export type RuleSeverity = "hint" | "suggest" | "warn" | "meta";

export type EditorRule = {
  id: string;
  title: string;
  category: string;
  scope: RuleScope;
  severity: RuleSeverity;
  rule: string;
  trigger_hint?: string;
  author_suggestion?: string;
  example?: { before?: string; after?: string };
  calibration?: string;
};

type RulesFile = {
  version: string;
  derived_from?: string;
  validated?: string;
  consume_note?: string;
  scopes?: Record<string, string>;
  rules: EditorRule[];
};

const data = rulesData as RulesFile;

export const RULES_VERSION = data.version;

// Yazar/editör modülünde geçerli kurallar: çeviriye özel olanlar elenir.
// Aday üreten kurallar (hint/suggest/warn) ile meta kalibrasyon ayrılır.
const authorScoped = data.rules.filter((r) => r.scope !== "translation");

export const AUTHOR_RULES: EditorRule[] = authorScoped.filter(
  (r) => r.severity !== "meta",
);

export const META_RULES: EditorRule[] = authorScoped.filter(
  (r) => r.severity === "meta",
);

// Aday üreten kuralların ait olduğu kategori adları (kart rozetleri için).
export const RULE_CATEGORIES: string[] = Array.from(
  new Set(AUTHOR_RULES.map((r) => r.category)),
);

// Kuralları, dil modelinin sistem komutuna gömülecek okunaklı bir bloğa çevirir.
// Her satır: kategori · başlık — tetikleyici ipucu → öneri yönü (kalibrasyon).
export function buildRulesBlock(): string {
  return AUTHOR_RULES.map((r) => {
    const parts = [
      `- [${r.category}] ${r.title} (önem: ${r.severity})`,
      r.trigger_hint ? `  • Ne zaman: ${r.trigger_hint}` : "",
      r.author_suggestion ? `  • Öneri yönü: ${r.author_suggestion}` : "",
      r.calibration ? `  • Dikkat: ${r.calibration}` : "",
    ].filter(Boolean);
    return parts.join("\n");
  }).join("\n");
}

// Meta kuralların (texture_calibration) talimat metnini birleştirir.
export function buildMetaBlock(): string {
  return META_RULES.map((r) => {
    const guidance = r.author_suggestion || r.rule;
    return `- ${r.title}: ${guidance}`;
  }).join("\n");
}
