import type { Locale } from "./config";

type ModuleCopy = {
  title: string;
  tagline: string;
  description: string;
  features: string[];
  cta: string;
  status: string;
};

type AuthCopy = {
  loginTitle: string;
  loginSubtitle: string;
  signupTitle: string;
  signupSubtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmLabel: string;
  confirmPlaceholder: string;
  loginCta: string;
  signupCta: string;
  forgot: string;
  orContinue: string;
  googleCta: string;
  haveAccount: string;
  noAccount: string;
  loginLink: string;
  signupLink: string;
  terms: string;
  notConnected: string;
  signOut: string;
  loggedInAs: string;
};

type CoverStudioCopy = {
  contentHeading: string;
  titleLabel: string;
  titlePlaceholder: string;
  authorLabel: string;
  authorPlaceholder: string;
  subtitleLabel: string;
  subtitlePlaceholder: string;
  isbnLabel: string;
  isbnPlaceholder: string;
  isbnHint: string;
  isbnValid: string;
  isbnInvalid: string;
  isbnAutoComplete: string;
  isbnRandomCta: string;
  navTemplates: string;
  navAi: string;
  navContent: string;
  navObjects: string;
  navColors: string;
  navBarcode: string;
  navImages: string;
  navSetup: string;
  navLayers: string;
  navLibrary: string;
  // "Yüklemelerim" paneli — kişisel görsel + şablon kütüphanesi
  libraryImagesHeading: string;
  libraryImagesHint: string;
  libraryUploadCta: string;
  libraryEmptyImages: string;
  libraryUseAsCover: string;
  libraryAddAsObject: string;
  libraryDelete: string;
  libraryTemplatesHeading: string;
  libraryTemplatesHint: string;
  librarySaveTemplateCta: string;
  libraryEmptyTemplates: string;
  libraryApplyTemplate: string;
  libraryTemplateNamePrompt: string;
  libraryDefaultTemplateName: string;
  libraryApplyConfirm: string;
  libraryLocalNote: string;
  barcodeHeading: string;
  barcodeHint: string;
  aiHeading: string;
  aiHint: string;
  aiModelLabel: string;
  aiModelHint: string;
  aiModelFlux: string;
  aiModelNano: string;
  aiModelIdeogram: string;
  aiEmbedLabel: string;
  aiEmbedHint: string;
  aiEmbedOn: string;
  aiEmbedOff: string;
  aiEmbedNotice: string;
  aiStyleLabel: string;
  aiScopeLabel: string;
  aiScopeHint: string;
  aiDescLabel: string;
  aiDescHint: string;
  aiDescPlaceholder: string;
  aiGenerate: string;
  aiBusy: string;
  aiErrorToken: string;
  aiErrorGeneric: string;
  aiTip: string;
  elemHeading: string;
  elemHint: string;
  elemPresetsLabel: string;
  elemPresetSeal: string;
  elemPresetSealEx: string;
  elemPresetBadge: string;
  elemPresetBadgeEx: string;
  elemPresetEmblem: string;
  elemPresetEmblemEx: string;
  elemPresetOrnament: string;
  elemPresetOrnamentEx: string;
  elemDescLabel: string;
  elemDescPlaceholder: string;
  elemGenerate: string;
  elemBusyLabel: string;
  elemTip: string;
  aiHistoryHeading: string;
  aiHistoryClear: string;
  aiHistoryRestore: string;
  aiHistoryHint: string;
  aiEditCta: string;
  aiEditTitle: string;
  aiEditHint: string;
  aiEditBrush: string;
  aiEditPromptLabel: string;
  aiEditPromptHint: string;
  aiEditPromptPlaceholder: string;
  aiEditUndo: string;
  aiEditClear: string;
  aiEditCancel: string;
  aiEditApply: string;
  aiEditBusy: string;
  aiEditNeedMask: string;
  aiEditNeedPrompt: string;
  aiEditModeFind: string;
  aiEditModePaint: string;
  aiEditFindLabel: string;
  aiEditFindHint: string;
  aiEditFindPlaceholder: string;
  aiEditFindCta: string;
  aiEditFinding: string;
  aiEditFindNotFound: string;
  aiEditFindFound: string;
  aiEditFindAdjust: string;
  aiEditFindAdjustHint: string;
  aiEditTagsCta: string;
  aiEditTagsBusy: string;
  aiEditTagsHint: string;
  aiEditTagsHeading: string;
  aiEditTagsEmpty: string;
  objectsHeading: string;
  objectsHint: string;
  objectsTip: string;
  objAddText: string;
  objAddRect: string;
  objAddCircle: string;
  objAddLine: string;
  objAddTriangle: string;
  objAddStar: string;
  objAddDiamond: string;
  dividersHeading: string;
  dividerDouble: string;
  dividerDot: string;
  dividerDiamond: string;
  shapeStyleLabel: string;
  shapeStyleHint: string;
  shapeStyleFill: string;
  shapeStyleOutline: string;
  strokeWidthLabel: string;
  cornerRadiusLabel: string;
  opacityShapeLabel: string;
  objTextDefault: string;
  objTextLabel: string;
  autoContrastLabel: string;
  autoContrastHint: string;
  freeTextHeading: string;
  freeTextHint: string;
  editTextInPanel: string;
  structTextHeading: string;
  structTextHint: string;
  spineAutoNote: string;
  structTextReset: string;
  geoHeading: string;
  geoHint: string;
  geoWidth: string;
  geoHeight: string;
  geoX: string;
  geoY: string;
  geoLockAspect: string;
  geoFullHeight: string;
  geoFitSafe: string;
  geoFillFront: string;
  geoCenter: string;
  geoEditCta: string;
  objColor: string;
  textAutoColorNote: string;
  textAutoColorRevert: string;
  textPanelLabel: string;
  textPanelHint: string;
  objSize: string;
  objFont: string;
  fontCatSerif: string;
  fontCatSans: string;
  fontCatDisplay: string;
  fontCatScript: string;
  fontCatMono: string;
  objSizeUp: string;
  objSizeDown: string;
  objTextMultilineHint: string;
  objAlign: string;
  objAlignLeft: string;
  objAlignCenter: string;
  objAlignRight: string;
  objLineSpacing: string;
  objLineSpacingUp: string;
  objLineSpacingDown: string;
  objDuplicate: string;
  objDuplicateHint: string;
  objDelete: string;
  deleteSelectedHint: string;
  selObjText: string;
  selObjRect: string;
  selObjCircle: string;
  selObjLine: string;
  selObjImage: string;
  selObjTriangle: string;
  selObjStar: string;
  selObjDiamond: string;
  selObjDivider: string;
  templatesHeading: string;
  blankHeading: string;
  blankButton: string;
  blankHint: string;
  inspectorClose: string;
  inspectorEmptyHint: string;
  selectionTitle: string;
  colorsHeading: string;
  colorsHint: string;
  colorsReset: string;
  colorBg: string;
  colorInk: string;
  colorAccent: string;
  imagesHeading: string;
  coverImageLabel: string;
  uploadCta: string;
  changeCta: string;
  removeCta: string;
  darkenLabel: string;
  opacityLabel: string;
  opacityHint: string;
  scopeLabel: string;
  scopeFront: string;
  scopeWrap: string;
  coverFitLabel: string;
  coverFitHint: string;
  coverFitFill: string;
  coverFitContain: string;
  coverFrameLabel: string;
  coverFrameHint: string;
  coverPanLabel: string;
  coverZoomLabel: string;
  coverFrameReset: string;
  logoLabel: string;
  logoSizeLabel: string;
  logoPosLabel: string;
  logoPosTop: string;
  logoPosBottom: string;
  showGuides: string;
  setupHeading: string;
  sizeLabel: string;
  sizeGroupKdp: string;
  sizeGroupTr: string;
  pageCountLabel: string;
  pageCountHint: string;
  paperLabel: string;
  paperUnit: string;
  bindingLabel: string;
  bindingSoft: string;
  bindingHard: string;
  bleedLabel: string;
  bleedHint: string;
  spineHeading: string;
  spineAuto: string;
  spineManualToggle: string;
  spineManualLabel: string;
  totalSizeLabel: string;
  backCover: string;
  spine: string;
  frontCover: string;
  bleedNote: string;
  exportHeading: string;
  exportHint: string;
  exportCta: string;
  exportBusy: string;
  pngExportCta: string;
  // Tek "İndir" menüsü
  downloadMenuCta: string;
  downloadPdf: string;
  downloadPng: string;
  downloadShare: string;
  downloadSaveTemplate: string;
  downloadShareUnsupported: string;
  cropMarksLabel: string;
  cropMarksHint: string;
  editHeading: string;
  editHint: string;
  editSelected: string;
  alignLabel: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  layerLabel: string;
  layerToBack: string;
  layerBackward: string;
  layerForward: string;
  layerToFront: string;
  rotateLabel: string;
  zOrderLabel: string;
  zBringToFront: string;
  zBringForward: string;
  zSendBackward: string;
  zSendToBack: string;
  layersHeading: string;
  layersHint: string;
  layersEmpty: string;
  layerSelectHint: string;
  layerShow: string;
  layerHide: string;
  layerLock: string;
  layerUnlock: string;
  resetPositions: string;
  draftSaved: string;
  draftSaving: string;
  draftRestored: string;
  draftNew: string;
  draftNewConfirm: string;
  selTitle: string;
  selAuthor: string;
  selSubtitle: string;
  selLogo: string;
  selRule: string;
  selFrame: string;
  selEmblem: string;
  selPanel: string;
  selSpine: string;
  selBarcode: string;
  selCover: string;
  selDarken: string;
  selBackground: string;
  darkenRemove: string;
  comingNextHeading: string;
  comingNext: string[];
};

type LayoutStudioCopy = {
  tagline: string;
  title: string;
  // Sol menü.
  navBook: string;
  navText: string;
  navPage: string;
  navType: string;
  // Kitap bilgileri paneli.
  bookHeading: string;
  bookTitleLabel: string;
  bookTitlePlaceholder: string;
  bookAuthorLabel: string;
  bookAuthorPlaceholder: string;
  bookBioLabel: string;
  bookBioPlaceholder: string;
  bookHint: string;
  // Metin paneli.
  textHeading: string;
  textLabel: string;
  textPlaceholder: string;
  textMarkdownHint: string;
  sampleCta: string;
  clearCta: string;
  statsWords: string;
  statsChars: string;
  // Kaynak seçimi (elle / Word).
  sourceManual: string;
  sourceWord: string;
  wordHeading: string;
  wordDropLabel: string;
  wordModeLabel: string;
  wordModeKdy: string;
  wordModeKdyHint: string;
  wordModeFaithful: string;
  wordModeFaithfulHint: string;
  wordImportCta: string;
  wordReplaceCta: string;
  wordClearCta: string;
  wordImporting: string;
  wordImportedInfo: string;
  wordError: string;
  wordHint: string;
  // Sayfa paneli.
  pageHeading: string;
  standardLabel: string;
  standardKdy: string;
  standardKdp: string;
  standardIngram: string;
  standardBnpress: string;
  standardLulu: string;
  standardHint: string;
  sizeLabel: string;
  sizeGroupKdy: string;
  sizeGroupKdp: string;
  sizeGroupTr: string;
  presetLabel: string;
  presetKdy: string;
  presetKdp: string;
  presetIngram: string;
  presetBnpress: string;
  presetLulu: string;
  presetComfortable: string;
  presetStandard: string;
  presetCompact: string;
  presetCustom: string;
  marginTop: string;
  marginBottom: string;
  marginInside: string;
  marginOutside: string;
  marginsHint: string;
  gutterLabel: string;
  gutterHint: string;
  gutterAuto: string;
  // Tipografi paneli.
  typeHeading: string;
  fontLabel: string;
  fontSizeLabel: string;
  leadingLabel: string;
  alignLabel: string;
  alignLeft: string;
  alignJustify: string;
  indentLabel: string;
  paraSpaceLabel: string;
  headingFontLabel: string;
  detectHeadings: string;
  detectHeadingsHint: string;
  // Yapısal seçenekler.
  structureHeading: string;
  frontMatterLabel: string;
  chapterRightLabel: string;
  runningHeadsLabel: string;
  pageNumbersLabel: string;
  hyphenateLabel: string;
  dropCapLabel: string;
  lineBreakLabel: string;
  lineBreakBalanced: string;
  lineBreakGreedy: string;
  tocEditHeading: string;
  tocEditHint: string;
  tocEntryPlaceholder: string;
  structureHint: string;
  // Sayfa rolleri (önizleme etiketi).
  roleTitle: string;
  roleBio: string;
  roleToc: string;
  roleBlank: string;
  // Önizleme.
  previewHeading: string;
  pageCountLabel: string;
  pageWord: string;
  zoomLabel: string;
  emptyPreview: string;
  // PDF dışa aktarma.
  exportPdfCta: string;
  exportingLabel: string;
  exportErrorLabel: string;
  cropMarksLabel: string;
  bleedLabel: string;
  bleedHint: string;
  kerningLabel: string;
  kerningHint: string;
  exportHint: string;
  exportHintKdp: string;
  exportHintIngram: string;
  imprintNote: string;
  imprintNoteKdp: string;
  // Birimler.
  unitMm: string;
  unitPt: string;
};

type EditorStudioCopy = {
  tagline: string;
  title: string;
  // Metin paneli.
  textHeading: string;
  textLabel: string;
  textPlaceholder: string;
  sampleCta: string;
  clearCta: string;
  statsWords: string;
  statsChars: string;
  // Word (.docx) içe aktarma.
  wordCta: string;
  wordImporting: string;
  wordImportedInfo: string;
  wordError: string;
  wordHint: string;
  // Word (.docx) dışa aktarma (düzenlenmiş metni indir).
  exportDocxCta: string;
  exportDocxBusy: string;
  exportDocxHint: string;
  exportDocxHintKept: string;
  exportDocxDoneKept: string;
  exportDocxDonePlain: string;
  exportDocxFilename: string;
  // Kontrol düğmesi ve durumlar.
  checkCta: string;
  checking: string;
  reviewCta: string;
  reviewing: string;
  reviewHint: string;
  deepLabel: string;
  deepHint: string;
  // Sonuç paneli.
  resultsHeading: string;
  emptyResults: string;
  resultsCount: string;
  noIssues: string;
  // Fazla boşluk temizliği (yerel, ücretsiz).
  tidyCount: string;
  tidyCta: string;
  tidyHint: string;
  // Öneri kartı.
  catSpelling: string;
  catGrammar: string;
  catLong: string;
  catRepetition: string;
  catFlow: string;
  catTone: string;
  catParagraph: string;
  // Editöryal inceleme — Gold üslup kuralları kategorileri + önem düzeyi.
  catFluency: string;
  catSentenceStructure: string;
  catDiction: string;
  catDialogue: string;
  catConcision: string;
  catClarity: string;
  catRegister: string;
  catPunctuation: string;
  severityWarn: string;
  severitySuggest: string;
  severityHint: string;
  longExplain: string;
  origLabel: string;
  fixLabel: string;
  contextLabel: string;
  revealCta: string;
  acceptCta: string;
  rejectCta: string;
  dismissCta: string;
  accepted: string;
  appliedNote: string;
  rejected: string;
  dismissed: string;
  // Kitap yapısı (yerel, ücretsiz).
  structureCta: string;
  structureHint: string;
  structureOutline: string;
  structureFound: string;
  structureNone: string;
  structureUntitled: string;
  structureIssuesHeading: string;
  structureTooLong: string;
  structureTooShort: string;
  structureGap: string;
  structureHierarchy: string;
  structureInconsistent: string;
  structureStyleBolum: string;
  structureStyleNumeric: string;
  structureStyleCaps: string;
  structureStylePlain: string;
  structureCompletenessHeading: string;
  structureIntro: string;
  structureConclusion: string;
  structurePresent: string;
  structureMissing: string;
  structureCompletenessHint: string;
  // Yayına hazırlık (Kategori 4, yerel/ücretsiz tipografi).
  prepCta: string;
  prepHint: string;
  prepNone: string;
  prepApply: string;
  prepApplyAll: string;
  prepCount: string;
  prepQuotesTitle: string;
  prepQuotesDesc: string;
  prepEllipsisTitle: string;
  prepEllipsisDesc: string;
  prepDashRangeTitle: string;
  prepDashRangeDesc: string;
  prepDialogueTitle: string;
  prepDialogueDesc: string;
  // Riskli içerik (Kategori 5, AI).
  riskCta: string;
  riskHint: string;
  risking: string;
  riskNone: string;
  catDefamation: string;
  catPrivacy: string;
  catCopyright: string;
  catClaim: string;
  catMisinfo: string;
  // Türe göre özel kontrol (Kategori 6, AI).
  genreLabel: string;
  genreFiction: string;
  genreSelfhelp: string;
  genreAcademic: string;
  genreCta: string;
  genreLoading: string;
  genreHint: string;
  genreNone: string;
  catCharacter: string;
  catTimeline: string;
  catPlot: string;
  catPromise: string;
  catAction: string;
  catCitation: string;
  catDefinition: string;
  catObjectivity: string;
  // Hata mesajları.
  errorGeneric: string;
  errorNoKey: string;
  errorBadKey: string;
  errorRateLimit: string;
  errorTooLong: string;
};

type PublishStudioCopy = {
  tagline: string;
  title: string;
  ebookTagline: string;
  ebookTitle: string;
  audiobookTagline: string;
  audiobookTitle: string;
  textHeading: string;
  textLabel: string;
  textPlaceholder: string;
  sampleCta: string;
  clearCta: string;
  statsWords: string;
  statsChars: string;
  wordCta: string;
  wordImporting: string;
  wordImportedInfo: string;
  wordError: string;
  transferHint: string;
  formatsHeading: string;
  formatEpub: string;
  formatEpubDesc: string;
  formatKindle: string;
  formatKindleDesc: string;
  formatPdf: string;
  formatPdfDesc: string;
  formatSoon: string;
  metaHeading: string;
  bookTitleLabel: string;
  bookTitlePlaceholder: string;
  bookAuthorLabel: string;
  bookAuthorPlaceholder: string;
  coverHeading: string;
  coverHint: string;
  coverCta: string;
  coverChangeCta: string;
  coverRemoveCta: string;
  coverFormatError: string;
  untitledBook: string;
  tocTitle: string;
  buildEbookCta: string;
  building: string;
  epubDoneNote: string;
  epubErrorNote: string;
  audioHeading: string;
  audioAi: string;
  audioAiDesc: string;
  audioOwn: string;
  audioOwnDesc: string;
  buildAudioCta: string;
  comingSoonNote: string;
  audioEngineLabel: string;
  audioEngines: { id: string; name: string; desc: string }[];
  audioVoiceLabel: string;
  audioVoices: { id: string; name: string }[];
  audioVoicesEleven: { id: string; name: string }[];
  audioSpeedLabel: string;
  audioListenSpeedLabel: string;
  audioListenSpeedHint: string;
  audioPreviewCta: string;
  audioPreviewBusy: string;
  audioPreviewText: string;
  audioChaptersHeading: string;
  audioChaptersHint: string;
  audioNarrateCta: string;
  audioNarrateBusy: string;
  audioDownload: string;
  audioCreditNote: string;
  audioTokenError: string;
  audioGenericError: string;
  audioOwnSoonNote: string;
  previewHeading: string;
  previewEmpty: string;
  chaptersFound: string;
  chapterUntitled: string;
  totalWords: string;
  previewReady: string;
};

type TanitimStudioCopy = {
  tagline: string;
  title: string;
  // Kitap bilgileri paneli.
  infoHeading: string;
  bookTitleLabel: string;
  bookTitlePlaceholder: string;
  bookAuthorLabel: string;
  bookAuthorPlaceholder: string;
  genreLabel: string;
  genrePlaceholder: string;
  audienceLabel: string;
  audiencePlaceholder: string;
  summaryLabel: string;
  summaryPlaceholder: string;
  toneLabel: string;
  tones: { id: string; name: string }[];
  sampleCta: string;
  clearCta: string;
  // Malzeme seçimi paneli.
  materialsHeading: string;
  materialsHint: string;
  matSocial: string;
  matSocialDesc: string;
  matPress: string;
  matPressDesc: string;
  matSales: string;
  matSalesDesc: string;
  matSoon: string;
  imageLabel: string;
  imageHint: string;
  // Üretim düğmesi.
  generateCta: string;
  regenerateCta: string;
  generating: string;
  soonNote: string;
  // Önizleme paneli.
  previewHeading: string;
  previewEmpty: string;
  previewPlanHeading: string;
  previewReady: string;
  // Üretilen sonuçlar.
  socialHeading: string;
  platformInstagram: string;
  platformX: string;
  platformFacebook: string;
  hashtagsHeading: string;
  pressHeading: string;
  salesDescHeading: string;
  backCoverHeading: string;
  copyCta: string;
  copiedCta: string;
  copyAllCta: string;
  // Instagram görseli.
  imageHeading: string;
  imageGenerating: string;
  downloadCta: string;
  // Hata mesajları.
  errorNoKey: string;
  errorBadKey: string;
  errorRateLimit: string;
  errorTooLong: string;
  errorGeneric: string;
  errorNoImageKey: string;
  errorImageGeneric: string;
};

export type Dictionary = {
  brand: string;
  nav: {
    home: string;
    cover: string;
    layout: string;
    editor: string;
    publish: string;
    audiobook: string;
    promo: string;
    projects: string;
    login: string;
    signup: string;
  };
  auth: AuthCopy;
  projelerStudio: {
    heading: string;
    subtitle: string;
    newProject: string;
    open: string;
    rename: string;
    renamePrompt: string;
    delete: string;
    deleteConfirm: string;
    empty: string;
    emptyHint: string;
    importLocal: string;
    untitled: string;
    loadError: string;
    creating: string;
  };
  home: {
    badge: string;
    title: string;
    subtitle: string;
    intro: string;
    modulesHeading: string;
    flowHeading: string;
    flow: string[];
  };
  modules: {
    cover: ModuleCopy;
    layout: ModuleCopy;
    editor: ModuleCopy;
    publish: ModuleCopy;
    audiobook: ModuleCopy;
    promo: ModuleCopy;
  };
  coverStudio: CoverStudioCopy;
  layoutStudio: LayoutStudioCopy;
  editorStudio: EditorStudioCopy;
  publishStudio: PublishStudioCopy;
  tanitimStudio: TanitimStudioCopy;
  common: {
    back: string;
    comingSoon: string;
    open: string;
  };
};

const tr: Dictionary = {
  brand: "tipostudio",
  nav: {
    home: "Ana Sayfa",
    cover: "Kapak",
    layout: "Mizanpaj",
    editor: "AI Editör",
    publish: "E-kitap",
    audiobook: "Sesli Kitap",
    promo: "Tanıtım",
    projects: "Projelerim",
    login: "Giriş yap",
    signup: "Kayıt ol",
  },
  projelerStudio: {
    heading: "Projelerim",
    subtitle: "Kayıtlı kitap projelerin. Aç, yeniden adlandır veya yenisini oluştur.",
    newProject: "Yeni proje",
    open: "Aç",
    rename: "Yeniden adlandır",
    renamePrompt: "Proje adı:",
    delete: "Sil",
    deleteConfirm: "Bu proje kalıcı olarak silinsin mi?",
    empty: "Henüz proje yok.",
    emptyHint: "İlk kitap projeni oluşturmak için “Yeni proje”ye bas.",
    importLocal: "Bu cihazdaki tasarımı proje olarak içe aktar",
    untitled: "Adsız proje",
    loadError: "Projeler yüklenemedi. Sayfayı yenileyip tekrar dene.",
    creating: "Oluşturuluyor…",
  },
  auth: {
    loginTitle: "Tekrar hoş geldin",
    loginSubtitle: "Kitap projelerine devam etmek için giriş yap.",
    signupTitle: "Hesap oluştur",
    signupSubtitle: "Kitabını hazırlamaya ücretsiz başla.",
    nameLabel: "Ad Soyad",
    namePlaceholder: "Adın",
    emailLabel: "E-posta",
    emailPlaceholder: "ornek@eposta.com",
    passwordLabel: "Şifre",
    passwordPlaceholder: "En az 8 karakter",
    confirmLabel: "Şifre (tekrar)",
    confirmPlaceholder: "Şifreni tekrar yaz",
    loginCta: "Giriş yap",
    signupCta: "Hesap oluştur",
    forgot: "Şifreni mi unuttun?",
    orContinue: "veya",
    googleCta: "Google ile devam et",
    haveAccount: "Zaten hesabın var mı?",
    noAccount: "Hesabın yok mu?",
    loginLink: "Giriş yap",
    signupLink: "Kayıt ol",
    terms: "Devam ederek Kullanım Koşulları ve Gizlilik Politikası'nı kabul etmiş olursun.",
    notConnected:
      "Üyelik sistemi henüz bağlı değil — bu ekran şimdilik yalnızca önizleme. Gerçek giriş bir sonraki adımda aktif olacak.",
    signOut: "Çıkış yap",
    loggedInAs: "Hesap",
  },
  home: {
    badge: "Tek pakette kitap hazırlığı",
    title: "Kitabını baştan sona profesyonelce hazırla",
    subtitle:
      "Yazarlar ve yayıncılar için kapak, iç tasarım ve AI destekli redaksiyon — hepsi tek yerde.",
    intro:
      "KDP ve KDY gibi sistemlere yüklemeye hazır bir kitap üretmek için gereken her şey. Metnini yükle, düzelt, sayfalarını diz, kapağını tasarla ve baskıya hazır çıktını al.",
    modulesHeading: "Altı ana modül",
    flowHeading: "Nasıl çalışır?",
    flow: [
      "Metnini yükle",
      "AI editör hataları ayıklasın",
      "Mizanpaj iç sayfaları dizsin",
      "Kapağını tasarla",
      "Baskıya hazır çıktıyı indir",
    ],
  },
  modules: {
    cover: {
      title: "Kapak Jeneratörü",
      tagline: "Baskıya hazır kapaklar",
      description:
        "Sürükle-bırak tuvalde profesyonel kitap kapakları tasarla. KDP ölçüleri, sırt (spine) hesabı ve barkod otomatik.",
      features: [
        "Hazır şablonlar ve özelleştirme",
        "KDP uyumlu bleed / trim / spine",
        "Otomatik ISBN barkodu",
        "Yüksek çözünürlüklü PDF çıktısı",
      ],
      cta: "Kapak tasarla",
      status: "Bu modül yakında geliyor — temel tuval altyapısı hazırlanıyor.",
    },
    layout: {
      title: "Mizanpaj (İç Tasarım)",
      tagline: "Baskıya hazır iç sayfalar",
      description:
        "Metnini düzgün tipografiyle baskıya hazır iç sayfalara dönüştür. Kenar boşlukları, sayfa numaraları ve bölüm düzeni otomatik.",
      features: [
        "Profesyonel tipografi ve satır düzeni",
        "Doğru kenar boşlukları ve trim ölçüleri",
        "Otomatik sayfa numarası ve bölüm başlıkları",
        "Baskıya hazır PDF çıktısı",
      ],
      cta: "Mizanpaj yap",
      status: "Bu modül yakında geliyor — en teknik kısım, dikkatle inşa ediliyor.",
    },
    editor: {
      title: "AI Destekli Editör",
      tagline: "Akıllı redaksiyon",
      description:
        "Yapay zekâ metnindeki dilbilgisi hatalarını bulur, üslubu değerlendirir, paragraf yapısını anlar ve tutarsızlıklar için öneriler sunar.",
      features: [
        "Dilbilgisi ve yazım denetimi",
        "Üslup ve akıcılık önerileri",
        "Paragraf ve bölüm tutarlılığı",
        "Çelişki ve tekrar tespiti",
      ],
      cta: "Metni düzenle",
      status: "Bu modül yakında geliyor — yapay zekâ bağlantısı kurulduğunda aktif olacak.",
    },
    publish: {
      title: "E-kitap",
      tagline: "Dağıtıma hazır e-kitap",
      description:
        "Hazır kitabını e-kitap (EPUB, Kindle, akan PDF) olarak üret. Bölümler otomatik tanınır, içindekiler kendiliğinden çıkar.",
      features: [
        "EPUB, Kindle ve akan PDF",
        "Otomatik bölüm ve içindekiler tanıma",
        "Tek tıkla indirme",
        "KDP / Kindle uyumlu çıktı",
      ],
      cta: "E-kitap üret",
      status: "Bu modül hazır — metni yapıştır, formatı seç, indir.",
    },
    audiobook: {
      title: "Sesli Kitap",
      tagline: "Yapay zekâ sesiyle seslendirme",
      description:
        "Kitabını doğal bir insan sesiyle seslendir. Mikrofon gerekmez; her bölümü ayrı ayrı seslendirip dinle ve indir.",
      features: [
        "Doğal yapay zekâ sesi (Türkçe dahil)",
        "Bölüm bölüm seslendirme ve indirme",
        "Çok sayıda ses ve hız seçeneği",
        "Kendi ses kaydını yükleme (yakında)",
      ],
      cta: "Sesli kitap üret",
      status: "Bu modül hazır — metni yapıştır, ses seç, seslendir.",
    },
    promo: {
      title: "Kitap Tanıtımı",
      tagline: "Yapay zekâ ile pazarlama",
      description:
        "Kitabının bilgilerinden sosyal medya gönderileri, basın bülteni ve satış sayfası metinlerini tek tıkla üret. Instagram için tanıtım görseli de hazırla.",
      features: [
        "Instagram, X ve Facebook gönderileri + hashtag",
        "Profesyonel basın / tanıtım bülteni",
        "Amazon açıklaması ve arka kapak yazısı",
        "Instagram için AI tanıtım görseli",
      ],
      cta: "Tanıtım üret",
      status: "Bu modül yapım aşamasında — kitap bilgisi formu hazır, yapay zekâ bağlantısı sırada.",
    },
  },
  coverStudio: {
    contentHeading: "Kapak içeriği",
    titleLabel: "Kitap başlığı",
    titlePlaceholder: "Kitabın adı",
    authorLabel: "Yazar",
    authorPlaceholder: "Yazar adı",
    subtitleLabel: "Üst başlık / tür (isteğe bağlı)",
    subtitlePlaceholder: "Örn. ROMAN",
    isbnLabel: "ISBN numarası (isteğe bağlı)",
    isbnPlaceholder: "Örn. 978-625-00-0000-1",
    isbnHint: "13 haneli ISBN girince arka kapakta gerçek, taranabilir barkod oluşur.",
    isbnValid: "✓ Geçerli — barkod oluşturuldu.",
    isbnInvalid: "Geçersiz ISBN. 13 haneli numarayı kontrol edin (yer tutucu gösteriliyor).",
    isbnAutoComplete: "✓ Son hane otomatik eklendi →",
    isbnRandomCta: "Rastgele test ISBN üret",
    navTemplates: "Şablon",
    navAi: "AI",
    navContent: "Metin",
    navObjects: "Nesne",
    navColors: "Renk",
    navBarcode: "Barkod",
    navImages: "Görsel",
    navSetup: "Ayar",
    navLayers: "Katman",
    navLibrary: "Yüklemelerim",
    libraryImagesHeading: "Görsellerim",
    libraryImagesHint:
      "Bilgisayardan yüklediğin ve AI ile ürettiğin görseller burada toplanır. Birine tıkla, kapak yap ya da nesne olarak ekle.",
    libraryUploadCta: "Görsel yükle",
    libraryEmptyImages:
      "Henüz görsel yok. Yükle düğmesiyle ekle ya da AI ile görsel üret.",
    libraryUseAsCover: "Kapak yap",
    libraryAddAsObject: "Nesne ekle",
    libraryDelete: "Sil",
    libraryTemplatesHeading: "Şablonlarım",
    libraryTemplatesHint:
      "O anki tasarımının tamamını (yazılar, renkler, konumlar, nesneler) kaydet; sonra tek tıkla geri yükle.",
    librarySaveTemplateCta: "Bu tasarımı şablon kaydet",
    libraryEmptyTemplates:
      "Henüz kayıtlı şablon yok. Bir tasarım yapıp “Bu tasarımı şablon kaydet” de.",
    libraryApplyTemplate: "Uygula",
    libraryTemplateNamePrompt: "Şablona bir isim ver:",
    libraryDefaultTemplateName: "Şablonum",
    libraryApplyConfirm:
      "Bu şablon mevcut tasarımının yerine geçecek. Devam edilsin mi?",
    libraryLocalNote:
      "Not: Bunlar şimdilik yalnız bu tarayıcıda saklanır. Giriş sistemi bağlanınca hesabına taşınacak.",
    barcodeHeading: "Barkod (ISBN)",
    barcodeHint:
      "ISBN numaranı gir; arka kapakta gerçek, taranabilir barkod oluşur.",
    aiHeading: "AI ile kapak görseli",
    aiHint:
      "Bir stil seç, istersen kitabını birkaç kelimeyle anlat; yapay zeka sanatsal arka planı üretsin. Başlığı uygulama kendi fontuyla üstüne yazar.",
    aiModelLabel: "Yapay zeka modeli",
    aiModelHint:
      "FLUX: hızlı ve sanatsal. Nano Banana Pro: komutları daha iyi izler, daha kaliteli. Ideogram v3: yazı/tipografide en iyisi — başlığı görsele basmak için ideal, ama daha yavaş ve maliyetli.",
    aiModelFlux: "FLUX 1.1 Pro",
    aiModelNano: "Nano Banana Pro",
    aiModelIdeogram: "Ideogram v3",
    aiEmbedLabel: "Başlık ve yazarı görsele bas",
    aiEmbedHint:
      "Açık: model, başlık ve yazar adını doğrudan görselin içine yazar (kendi yazı katmanların gizlenir). Kapalı: yalnız sanat üretir, başlığı uygulama üstüne koyar.",
    aiEmbedOn: "Görsele bas",
    aiEmbedOff: "Yalnız sanat",
    aiEmbedNotice:
      "Başlık görsele gömüldü; çift olmasın diye kendi başlık/yazar yazı katmanların gizlendi. Katman panelinden geri açabilirsin.",
    aiStyleLabel: "Stil",
    aiScopeLabel: "Kapsam",
    aiScopeHint:
      "Tam sarmal: arka+sırt+ön kapağı saran tek kesintisiz görsel (önerilir). Sadece ön: yalnızca ön kapak.",
    aiDescLabel: "Açıklama (isteğe bağlı)",
    aiDescHint: "Örn. ‘karlı bir dağ köyü, gece, sıcak ışık’. Boş bırakırsan stil tek başına çalışır.",
    aiDescPlaceholder: "Kitabının havasını birkaç kelimeyle anlat…",
    aiGenerate: "Görsel üret",
    aiBusy: "Üretiliyor… (~10-20 sn)",
    aiErrorToken:
      "Henüz API anahtarı eklenmemiş. .env.local dosyasına Replicate token’ını yapıştırıp sunucuyu yeniden başlat.",
    aiErrorGeneric:
      "Görsel üretilemedi. Birkaç saniye sonra tekrar dene; sorun sürerse anahtarı ve bakiyeni kontrol et.",
    aiTip:
      "Üretilen görsel ‘kapak görseli’ olarak yerleşir. Beğenmezsen tekrar üret ya da Görsel panelinden karartmayı ayarla.",
    elemHeading: "AI ile tasarım öğesi",
    elemHint:
      "Kapağın üstüne koymak için tek bir öğe üretir (mühür, rozet, amblem, süsleme). Arka planı saydam gelir; tuvalde taşıyıp boyutlandırabilir, çoğaltabilirsin.",
    elemPresetsLabel: "Hızlı başlangıç",
    elemPresetSeal: "Mühür",
    elemPresetSealEx:
      "25. yıl mührü, yuvarlak, zarif çerçeve, ortada ince serif yazı, altın tonları",
    elemPresetBadge: "Rozet",
    elemPresetBadgeEx:
      "‘Çok Satan’ yazan şık bir rozet, kurdele şeritli, klasik tasarım",
    elemPresetEmblem: "Amblem",
    elemPresetEmblemEx:
      "Daire içinde defne yaprağı amblemi, simetrik, minimal çizgi tasarım",
    elemPresetOrnament: "Süsleme",
    elemPresetOrnamentEx:
      "İnce çizgili dekoratif ayraç (bölüm süslemesi), simetrik, zarif",
    elemDescLabel: "Ne üretmek istiyorsun?",
    elemDescPlaceholder:
      "ör. 25. yıl mührü, altın daire, ortada ince zarif serif yazı",
    elemGenerate: "Öğe üret",
    elemBusyLabel: "Üretiliyor… (biraz sürebilir)",
    elemTip:
      "Üretim iki adımlı (önce çizim, sonra arka planı temizleme) olduğu için biraz uzun sürebilir. Her üretim kredi harcar.",
    aiHistoryHeading: "Son üretimler",
    aiHistoryClear: "Temizle",
    aiHistoryRestore: "Bu görseli geri yükle",
    aiHistoryHint:
      "Son 6 üretim bu cihazda saklanır (sayfayı yenilesen bile durur). Birine tıkla, kapağa geri yüklensin.",
    aiEditCta: "Boya & değiştir",
    aiEditTitle: "Boya & değiştir",
    aiEditHint:
      "Değiştirmek ya da silmek istediğin yeri fırçayla boya, sonra oraya ne geleceğini yaz. AI sadece boyadığın bölgeyi yeniden çizer.",
    aiEditBrush: "Fırça",
    aiEditPromptLabel: "Boyadığın yere ne gelsin?",
    aiEditPromptHint:
      "Silmek istiyorsan arka planı tarif et (örn. ‘düz duvar, boş zemin’). Değiştirmek istiyorsan yeni şeyi yaz (örn. ‘bir saksı çiçek’).",
    aiEditPromptPlaceholder: "örn. boş ahşap masa",
    aiEditUndo: "Geri al",
    aiEditClear: "Temizle",
    aiEditCancel: "Vazgeç",
    aiEditApply: "Uygula",
    aiEditBusy: "İşleniyor…",
    aiEditNeedMask: "Önce değiştirmek istediğin yeri seç (bul ya da fırçayla boya).",
    aiEditNeedPrompt: "Seçtiğin yere ne geleceğini yaz.",
    aiEditModeFind: "Yaz & bul",
    aiEditModePaint: "Elle boya",
    aiEditFindLabel: "Hangi nesneyi seçeyim?",
    aiEditFindHint:
      "Türkçe yazabilirsin (örn. ‘ağaç’, ‘fincan’) — arka planda çevrilir. Bulamazsa İngilizcesini dene ya da ‘Elle boya’ya geç.",
    aiEditFindPlaceholder: "örn. ağaç",
    aiEditFindCta: "Bul",
    aiEditFinding: "Aranıyor…",
    aiEditFindNotFound:
      "Bu nesne bulunamadı. Başka bir kelime (ya da İngilizcesini) dene veya ‘Elle boya’ ile kendin seç.",
    aiEditFindFound: "Nesne bulundu ve seçildi. Şimdi yerine ne geleceğini yaz.",
    aiEditFindAdjust: "Seçim alanı (dar ↔ geniş)",
    aiEditFindAdjustHint:
      "Seçim nesnenin kenarlarını kaçırıyorsa sağa al (genişlet); fazla taşıyorsa sola al. Değiştirince tekrar ‘Bul’a bas.",
    aiEditTagsCta: "Nesneleri otomatik bul",
    aiEditTagsBusy: "Nesneler taranıyor…",
    aiEditTagsHint:
      "Ne yazacağını bilemiyorsan buna bas; AI görseldeki nesneleri listeler.",
    aiEditTagsHeading: "Bir nesneye tıkla, otomatik seçilsin:",
    aiEditTagsEmpty:
      "Belirgin bir nesne bulunamadı. Kelimeyi kendin yazmayı dene.",
    objectsHeading: "Nesneler",
    objectsHint: "Tuvale kendi metin ve şekillerini ekle.",
    objectsTip:
      "Eklenen nesne ön kapağın ortasına düşer. Tuvalde tıklayıp sürükle, döndür, renk/boyutunu değiştir ya da sil.",
    objAddText: "Metin",
    objAddRect: "Dikdörtgen",
    objAddCircle: "Daire",
    objAddLine: "Çizgi",
    objAddTriangle: "Üçgen",
    objAddStar: "Yıldız",
    objAddDiamond: "Elmas",
    dividersHeading: "Hazır ayraçlar",
    dividerDouble: "Çift çizgi",
    dividerDot: "Nokta-çizgi",
    dividerDiamond: "Elmaslı ayraç",
    shapeStyleLabel: "Şekil stili",
    shapeStyleHint: "İçi dolu mu olsun, yoksa sadece çerçeve (içi boş) mi?",
    shapeStyleFill: "İçi dolu",
    shapeStyleOutline: "Sadece çerçeve",
    strokeWidthLabel: "Çizgi/çerçeve kalınlığı",
    cornerRadiusLabel: "Köşe yuvarlaklığı",
    opacityShapeLabel: "Saydamlık",
    objTextDefault: "Metniniz",
    objTextLabel: "Metin",
    autoContrastLabel: "Yazıyı arka plana göre otomatik okunur yap",
    autoContrastHint:
      "Görsel koyuysa başlık ve yazar beyaz, açıksa siyah olur; arkasına hafif gölge eklenir. Böylece hangi görseli koyarsan koy yazılar okunur kalır.",
    freeTextHeading: "Serbest metin",
    freeTextHint:
      "Tuvaldeki bir metni seçince yazı tipi, boyut ve rengini buradan düzenlersin.",
    editTextInPanel: "Metni düzenle →",
    structTextHeading: "Seçili yazı",
    structTextHint:
      "Başlık, yazar, alt başlık veya sırt yazısını seçtin. Yazı tipini, boyutunu ve rengini buradan değiştir.",
    structTextReset: "Bu yazıyı varsayılana döndür",
    spineAutoNote:
      "Sırt yazısı başlık ve yazardan otomatik oluşur. Değiştirmek için başlığı veya yazarı düzenle.",
    geoHeading: "Konum & boyut",
    geoHint: "Seçili şeklin ölçülerini milimetre cinsinden gir. Konum, şeklin merkezini sayfanın sol/üst kenarından ölçer.",
    geoWidth: "Genişlik (mm)",
    geoHeight: "Yükseklik (mm)",
    geoX: "Yatay (X, mm)",
    geoY: "Dikey (Y, mm)",
    geoLockAspect: "Oranı koru (genişlik/yükseklik birlikte)",
    geoFullHeight: "Tam sayfa yüksekliği",
    geoFitSafe: "Güvenli alana sığdır",
    geoFillFront: "Ön kapağı doldur",
    geoCenter: "Ortaya getir",
    geoEditCta: "Boyut & konum →",
    objColor: "Renk",
    textAutoColorNote: "Renk, kapak görseline göre otomatik ayarlanıyor (okunurluk).",
    textAutoColorRevert: "Otomatik renge dön",
    textPanelLabel: "Arkasına okuma paneli koy",
    textPanelHint:
      "Metnin arkasına yarı saydam koyu panel ekler — parlak/karışık zeminde garanti okunur.",
    objSize: "Boyut",
    objFont: "Yazı tipi",
    fontCatSerif: "Serif (edebi)",
    fontCatSans: "Sans (modern)",
    fontCatDisplay: "Gösterişli",
    fontCatScript: "El yazısı",
    fontCatMono: "Mono",
    objSizeUp: "Yazıyı büyüt",
    objSizeDown: "Yazıyı küçült",
    objTextMultilineHint: "Alt satıra geçmek için Enter'a basın.",
    objAlign: "Hizalama",
    objAlignLeft: "Sola yasla",
    objAlignCenter: "Ortala",
    objAlignRight: "Sağa yasla",
    objLineSpacing: "Satır aralığı",
    objLineSpacingUp: "Satır aralığını artır",
    objLineSpacingDown: "Satır aralığını azalt",
    objDuplicate: "Çoğalt",
    objDuplicateHint: "Seçili nesnenin bir kopyasını oluştur",
    objDelete: "Sil",
    deleteSelectedHint:
      "Seçili nesneyi sil (Delete tuşu). Şablon ögeleri gizlenir, Katman panelinden geri açılır.",
    selObjText: "Metin",
    selObjRect: "Dikdörtgen",
    selObjCircle: "Daire",
    selObjLine: "Çizgi",
    selObjImage: "AI öğe",
    selObjTriangle: "Üçgen",
    selObjStar: "Yıldız",
    selObjDiamond: "Elmas",
    selObjDivider: "Ayraç",
    templatesHeading: "Hazır şablonlar",
    blankHeading: "Yeni tasarım",
    blankButton: "Boş tuval",
    blankHint: "Sıfırdan başla — boş tuvale kendi yazı, şekil ve AI öğelerini ekle.",
    inspectorClose: "Kapat",
    inspectorEmptyHint: "Bir nesne seçince ayarları burada görünür.",
    selectionTitle: "Seçim",
    colorsHeading: "Renkler",
    colorsHint: "Şablonun renklerini dilediğin gibi değiştir.",
    colorsReset: "Şablon renkleri",
    colorBg: "Zemin",
    colorInk: "Yazı",
    colorAccent: "Vurgu",
    imagesHeading: "Görsel ve logo",
    coverImageLabel: "Kapak görseli",
    uploadCta: "Görsel yükle",
    changeCta: "Değiştir",
    removeCta: "Kaldır",
    darkenLabel: "Karartma (yazı okunsun)",
    darkenRemove: "Karartmayı kaldır",
    opacityLabel: "Saydamlık",
    opacityHint: "Düşürünce görsel soluklaşır; arkadaki zemin rengi içinden hafifçe görünür.",
    scopeLabel: "Görsel nereyi kaplasın?",
    scopeFront: "Ön kapak",
    scopeWrap: "Tüm kapak",
    coverFitLabel: "Görsel yerleşimi",
    coverFitHint:
      "Doldur: alanı tamamen kaplar, kenarlar kırpılabilir. Sığdır: görselin tamamı görünür, kenarda boşluk kalabilir.",
    coverFitFill: "Doldur (kırp)",
    coverFitContain: "Sığdır (tamamı)",
    coverFrameLabel: "Görseli yerleştir",
    coverFrameHint: "Tam sarmal görselde ana figürü ön kapağa getirmek için kaydır/yakınlaştır.",
    coverPanLabel: "Yatay kaydır (sol ↔ sağ)",
    coverZoomLabel: "Yakınlaştır",
    coverFrameReset: "Sıfırla",
    logoLabel: "Logo",
    logoSizeLabel: "Logo boyutu",
    logoPosLabel: "Logo konumu",
    logoPosTop: "Üst",
    logoPosBottom: "Alt",
    showGuides: "Baskı kılavuzlarını göster",
    setupHeading: "Kitap ayarları",
    sizeLabel: "Kitap boyutu",
    sizeGroupKdp: "Amazon KDP",
    sizeGroupTr: "Türkiye boyları",
    pageCountLabel: "Sayfa sayısı",
    pageCountHint: "Sırt kalınlığı sayfa sayısına göre hesaplanır.",
    paperLabel: "Kağıt kalınlığı",
    paperUnit: "gr",
    bindingLabel: "Cilt türü",
    bindingSoft: "Karton kapak",
    bindingHard: "Sert kapak",
    bleedLabel: "Taşma payı (bleed)",
    bleedHint: "Her kenardan taşma. KDP için 3.175 mm; Türkiye matbaaları genelde 3–5 mm ister.",
    spineHeading: "Sırt (spine)",
    spineAuto: "Otomatik hesaplandı",
    spineManualToggle: "Sırtı elle gireceğim",
    spineManualLabel: "Sırt kalınlığı (mm)",
    totalSizeLabel: "Tam kapak ölçüsü",
    backCover: "Arka kapak",
    spine: "Sırt",
    frontCover: "Ön kapak",
    bleedNote: "Kesikli çizgiler kesim payını ve sırt katlama yerlerini gösterir.",
    exportHeading: "Baskıya hazır PDF",
    exportHint: "Tam kapak, 300 DPI, taşma payı dahil — matbaaya gönderebilirsin.",
    exportCta: "PDF indir",
    exportBusy: "Hazırlanıyor…",
    pngExportCta: "PNG indir",
    downloadMenuCta: "İndir",
    downloadPdf: "PDF olarak indir",
    downloadPng: "PNG olarak indir",
    downloadShare: "Paylaş",
    downloadSaveTemplate: "Şablona kaydet",
    downloadShareUnsupported:
      "Paylaşım bu tarayıcıda desteklenmiyor; bunun yerine PNG indirildi.",
    cropMarksLabel: "Kesim işaretleri ekle (cross)",
    cropMarksHint: "Matbaa için köşelere kesim işareti koyar. KDP/Amazon için kapatın.",
    editHeading: "Düzenleme",
    editHint: "Sürükleyerek taşıyın (ortaya yapışır), köşelerden boyutlandırın, üstteki tutamaçtan veya derece kutusundan döndürün.",
    editSelected: "Seçili",
    alignLabel: "Hizala",
    layerLabel: "Katman",
    layerToBack: "En arkaya",
    layerBackward: "Geri",
    layerForward: "İleri",
    layerToFront: "En öne",
    rotateLabel: "Döndür",
    zOrderLabel: "Sıra",
    zBringToFront: "En öne getir",
    zBringForward: "Bir öne getir",
    zSendBackward: "Bir arkaya gönder",
    zSendToBack: "En arkaya gönder",
    layersHeading: "Katmanlar",
    layersHint: "Yukarı/aşağı oklarla sıralayın (üst = en önde). İsme tıklayınca tuvalde seçilir. Gözle gizleyin, kilitle sabitleyin.",
    layersEmpty: "Henüz öğe yok.",
    layerSelectHint: "Tuvalde seç",
    layerShow: "Göster",
    layerHide: "Gizle",
    layerLock: "Kilitle",
    layerUnlock: "Kilidi aç",
    alignLeft: "Sola",
    alignCenter: "Ortala",
    alignRight: "Sağa",
    resetPositions: "Düzeni sıfırla",
    draftSaved: "Taslak kaydedildi",
    draftSaving: "Kaydediliyor…",
    draftRestored: "Önceki tasarımınız geri yüklendi.",
    draftNew: "Yeni tasarım",
    draftNewConfirm:
      "Mevcut tasarım silinip sıfırdan başlanacak. Devam edilsin mi?",
    selTitle: "Başlık",
    selAuthor: "Yazar",
    selSubtitle: "Alt başlık",
    selLogo: "Logo",
    selRule: "Çizgi",
    selFrame: "Çerçeve",
    selEmblem: "Amblem",
    selPanel: "Panel",
    selSpine: "Sırt yazısı",
    selBarcode: "Barkod",
    selCover: "Kapak görseli",
    selDarken: "Karartma örtüsü",
    selBackground: "Arka plan (zemin)",
    comingNextHeading: "Sırada ne var?",
    comingNext: [
      "Renkleri özelleştirme",
      "Baskıya hazır PDF çıktısı",
    ],
  },
  layoutStudio: {
    tagline: "İç tasarım · KDY",
    title: "Mizanpaj",
    navBook: "Kitap",
    navText: "Metin",
    navPage: "Sayfa",
    navType: "Yazı",
    bookHeading: "Kitap bilgileri",
    bookTitleLabel: "Kitap adı",
    bookTitlePlaceholder: "Örn. Sessiz Sokaklar",
    bookAuthorLabel: "Yazar",
    bookAuthorPlaceholder: "Örn. Ayşe Demir",
    bookBioLabel: "Yazar biyografisi",
    bookBioPlaceholder: "Yazar hakkında kısa bir tanıtım yazısı (isteğe bağlı).",
    bookHint:
      "Bu bilgiler başlık sayfası, biyografi sayfası ve üst bilgilerde kullanılır.",
    textHeading: "Kitap metni",
    textLabel: "Metni buraya yapıştırın",
    textPlaceholder:
      "Kitabınızın metnini buraya yapıştırın. Paragrafları boş satırla ayırın. Ana bölüm için # , alt başlık için ## , ### , #### kullanın. Alıntı için satırı > ile başlatın.",
    textMarkdownHint:
      "# Ana bölüm · ## ### #### alt başlıklar · > alıntı. Ana bölümler otomatik sağ sayfada başlar.",
    sampleCta: "Örnek metin koy",
    clearCta: "Temizle",
    statsWords: "kelime",
    statsChars: "karakter",
    sourceManual: "Elle yaz",
    sourceWord: "Word'den aktar",
    wordHeading: "Word belgesinden aktar",
    wordDropLabel: "Word dosyası seçin (.docx)",
    wordModeLabel: "Aktarma biçimi",
    wordModeKdy: "KDY düzenine uyarla",
    wordModeKdyHint:
      "Yapıyı korur (paragraflar, başlıklar, ortalı satırlar, kalın/italik) ama punto, satır aralığı ve girintiyi KDY ölçülerine getirir.",
    wordModeFaithful: "Word'e sadık kal",
    wordModeFaithfulHint:
      "Word'deki punto, paragraf aralığı, ilk-satır girintisi ve boş paragrafları olabildiğince aynen taşır.",
    wordImportCta: "Belgeyi aktar",
    wordReplaceCta: "Başka belge aktar",
    wordClearCta: "Aktarımı kaldır",
    wordImporting: "Aktarılıyor…",
    wordImportedInfo: "{paragraphs} paragraf · {headings} başlık aktarıldı.",
    wordError: "Belge okunamadı. Geçerli bir .docx dosyası mı?",
    wordHint:
      "Yalnızca .docx desteklenir (eski .doc değil). Word'de Farklı Kaydet → .docx ile dönüştürebilirsiniz.",
    pageHeading: "Sayfa ve kenar boşlukları",
    standardLabel: "Baskı standardı",
    standardKdy: "KDY (Kitapyurdu)",
    standardKdp: "Amazon KDP",
    standardIngram: "IngramSpark",
    standardBnpress: "B&N Press",
    standardLulu: "Lulu",
    standardHint:
      "Standardı seçince boyut, kenar boşlukları, taşma ve PDF çıkışı otomatik o standarda göre ayarlanır.",
    sizeLabel: "Kitap boyu",
    sizeGroupKdy: "KDY (Kitapyurdu)",
    sizeGroupKdp: "İnç tabanlı boylar (KDP · Ingram · B&N · Lulu)",
    sizeGroupTr: "Türkiye boyları",
    presetLabel: "Hazır ayar",
    presetKdy: "KDY",
    presetKdp: "KDP",
    presetIngram: "Ingram",
    presetBnpress: "B&N",
    presetLulu: "Lulu",
    presetComfortable: "Ferah",
    presetStandard: "Standart",
    presetCompact: "Sıkışık",
    presetCustom: "Özel",
    marginTop: "Üst",
    marginBottom: "Alt",
    marginInside: "İç (cilt)",
    marginOutside: "Dış",
    marginsHint:
      "KDY varsayılanı: üst/alt 20, iç 20, dış 15 mm. İç kenar cilde bakar.",
    gutterLabel: "Cilt payı",
    gutterHint:
      "Sayfa sayısı arttıkça cilt daha çok yer kaplar; bu pay iç kenara eklenir.",
    gutterAuto: "Otomatik öner",
    typeHeading: "Yazı ayarları",
    fontLabel: "Yazı tipi",
    fontSizeLabel: "Punto",
    leadingLabel: "Satır aralığı",
    alignLabel: "Hizalama",
    alignLeft: "Sola",
    alignJustify: "İki yana yasla",
    indentLabel: "Paragraf girintisi",
    paraSpaceLabel: "Paragraf arası boşluk",
    headingFontLabel: "Başlık yazı tipi",
    detectHeadings: "Başlıkları otomatik algıla",
    detectHeadingsHint:
      "# ile başlayan ya da tamamı BÜYÜK harf satırlar başlık sayılır.",
    structureHeading: "Yapı",
    frontMatterLabel: "Başlık + biyografi + içindekiler",
    chapterRightLabel: "Bölümler sağ sayfada başlasın",
    runningHeadsLabel: "Üst bilgi (yazar / kitap adı)",
    pageNumbersLabel: "Sayfa numaraları",
    hyphenateLabel: "Satır sonu heceleme (Türkçe)",
    dropCapLabel: "Bölüm başı büyük baş harf",
    lineBreakLabel: "Satır kırma",
    lineBreakBalanced: "Dengeli (Knuth–Plass)",
    lineBreakGreedy: "Sıkı (saldırgan)",
    tocEditHeading: "İçindekiler başlıkları",
    tocEditHint: "Bölümün İçindekiler'de görünen adını değiştirin. Boş bırakırsanız bölüm başlığı kullanılır. Sayfa numaraları otomatik kalır.",
    tocEntryPlaceholder: "(bölüm başlığı)",
    structureHint:
      "KDY ilk 2 sayfayı (künye) sistem ekler; içindekiler otomatik oluşturulur.",
    roleTitle: "Başlık sayfası",
    roleBio: "Biyografi",
    roleToc: "İçindekiler",
    roleBlank: "Boş sayfa",
    previewHeading: "Önizleme",
    pageCountLabel: "Toplam",
    pageWord: "sayfa",
    zoomLabel: "Yakınlaştır",
    emptyPreview:
      "Kitap adını ve metni girin; başlık sayfası, içindekiler ve bölümler burada belirir.",
    exportPdfCta: "PDF indir",
    exportingLabel: "Hazırlanıyor…",
    exportErrorLabel: "PDF oluşturulamadı. Lütfen tekrar deneyin.",
    cropMarksLabel: "Kesim işaretleri + 5 mm taşma",
    bleedLabel: "Taşma (bleed) ekle — kenara taşan görseller için",
    bleedHint:
      "Açık: PDF her kenardan 3,175 mm taşma ile üretilir (kenara dayalı görseller için). Kapalı: PDF tam kesim boyutunda — düz metin kitapları için en sorunsuzu.",
    kerningLabel: "Harf aralığı düzeltme (kerning)",
    kerningHint:
      "Açık: V, W, Y, T gibi çıkıntılı büyük harflerle yanındaki harfleri birbirine yaklaştırır (örn. “VA”, “Ta”). PDF'i daha profesyonel gösterir.",
    exportHint:
      "İç sayfa PDF'i 130×195 trim + 5 mm taşma payı ile, fontlar gömülü olarak üretilir. Metin siyah (RGB); KDY'nin istediği gerçek CMYK dönüşümü ayrı bir sunucu adımı gerektirir.",
    exportHintKdp:
      "İç sayfa PDF'i tam kesim boyutunda, kesim işareti olmadan, fontlar gömülü olarak üretilir — Amazon KDP'nin istediği biçim. Taşma açıksa her kenara 3,175 mm eklenir.",
    exportHintIngram:
      "İç sayfa PDF'i tam kesim boyutunda, kesim işareti olmadan, fontlar gömülü olarak üretilir. IngramSpark ayrıca PDF/X-1a / PDF/X-3 ister; bu son dönüşüm (CMYK + PDF/X) ayrı bir adımdır. Taşma açıksa her kenara 3,175 mm eklenir.",
    imprintNote:
      "İlk 2 sayfayı (logo + künye) KDY otomatik ekler; bu dosyada bulunmaz. PDF doğrudan başlık sayfasıyla başlar.",
    imprintNoteKdp:
      "KDP'de tüm sayfaları sen sağlarsın. Telif/künye sayfasını eklemeyi unutma; PDF başlık sayfasıyla başlar.",
    unitMm: "mm",
    unitPt: "pt",
  },
  editorStudio: {
    tagline: "AI Editör · Redaksiyon",
    title: "Metin Kontrolü",
    textHeading: "Kitap metni",
    textLabel: "Metni buraya yapıştırın",
    textPlaceholder:
      "Kontrol etmek istediğiniz metni buraya yapıştırın. Yapay zekâ yazım, üslup ve tutarlılık açısından inceleyip öneriler çıkaracak. Karar her zaman sizde kalır.",
    sampleCta: "Örnek metin koy",
    clearCta: "Temizle",
    statsWords: "kelime",
    statsChars: "karakter",
    wordCta: "Word'den al (.docx)",
    wordImporting: "Aktarılıyor…",
    wordImportedInfo: "{paragraphs} paragraf metne aktarıldı.",
    wordError: "Belge okunamadı. Geçerli bir .docx dosyası mı?",
    wordHint:
      "Yalnızca .docx desteklenir (eski .doc değil). Word'de Farklı Kaydet → .docx ile dönüştürebilirsiniz. Yalnız metin alınır; biçim, başlık vb. korunmaz.",
    exportDocxCta: "Word olarak indir",
    exportDocxBusy: "Hazırlanıyor…",
    exportDocxHint:
      "Düzenlediğiniz metni .docx dosyası olarak indirir. Her satır bir paragraf olur; süslü biçimlendirme eklenmez.",
    exportDocxHintKept:
      "Yüklediğiniz Word'ün biçimi (başlık, hizalama, stiller) korunur; yalnız KABUL ETTİĞİNİZ düzeltmeler dosyanın içine işlenir. Mizanpaj için yapı bozulmaz.",
    exportDocxDoneKept:
      "İndirildi. Orijinal biçim korundu, {count} düzeltme dosyaya işlendi.",
    exportDocxDonePlain: "İndirildi (düz metin .docx).",
    exportDocxFilename: "duzenlenmis-metin",
    checkCta: "Kontrol et",
    checking: "Kontrol ediliyor…",
    reviewCta: "Editöryal inceleme",
    reviewing: "İnceleniyor…",
    reviewHint: "Akış, sözcük seçimi, cümle yapısı, diyalog ve akıcı Türkçe üslubunu değerlendirir (usta çeviriden damıtılmış kurallarla); düzeltmez, önerir.",
    deepLabel: "Derin kontrol",
    deepHint: "Daha güçlü model; en ince hataları da yakalar ama biraz daha pahalıdır.",
    resultsHeading: "Öneriler",
    emptyResults:
      "Soldaki kutuya metninizi yapıştırın. Öneriler — eski ifade, önerilen düzeltme ve nedeni — burada tek tek listelenecek.",
    resultsCount: "{count} öneri bulundu",
    noIssues: "Belirgin bir sorun bulunamadı. Metin temiz görünüyor.",
    tidyCount: "{count} fazla boşluk",
    tidyCta: "Boşlukları temizle",
    tidyHint: "Çift boşluk, satır sonu boşlukları ve fazladan boş satırları tek tıkla temizler.",
    catSpelling: "Yazım",
    catGrammar: "Dilbilgisi",
    catLong: "Uzun cümle",
    catRepetition: "Tekrar",
    catFlow: "Akış",
    catTone: "Üslup",
    catParagraph: "Paragraf",
    catFluency: "Doğal akış",
    catSentenceStructure: "Cümle yapısı",
    catDiction: "Sözcük seçimi",
    catDialogue: "Diyalog",
    catConcision: "Sadeleştirme",
    catClarity: "Netlik",
    catRegister: "Hitap/üslup",
    catPunctuation: "Noktalama",
    severityWarn: "Önemli",
    severitySuggest: "Öneri",
    severityHint: "Hafif",
    longExplain: "Bu cümle uzun ({count} kelime). Okunması zorlaşabilir; bölmeyi düşünebilirsiniz.",
    origLabel: "Eski",
    fixLabel: "Öneri",
    contextLabel: "Metindeki yeri",
    revealCta: "Yerini göster",
    acceptCta: "Kabul et",
    rejectCta: "Yoksay",
    dismissCta: "Tamam, anladım",
    accepted: "Düzeltildi",
    appliedNote: "Bu düzeltme metne uygulandı.",
    rejected: "Yok sayıldı",
    dismissed: "Görüldü",
    structureCta: "Kitap yapısı",
    structureHint: "Bölümleri, uzunluklarını ve yapı sorunlarını çıkarır (yerel, ücretsiz).",
    structureOutline: "İçindekiler",
    structureFound: "{count} bölüm bulundu",
    structureNone: "Belirgin bölüm başlığı bulunamadı. Her bölüm başlığını kendi satırına yazarsanız (örn. “Bölüm 1”), yapıyı çıkarabilirim.",
    structureUntitled: "(başlıksız giriş)",
    structureIssuesHeading: "Yapı notları",
    structureTooLong: "«{title}» diğer bölümlere göre çok uzun ({words} kelime, ortalama {avg}).",
    structureTooShort: "«{title}» diğer bölümlere göre çok kısa ({words} kelime, ortalama {avg}).",
    structureGap: "Bölüm numaraları ardışık görünmüyor; bir bölüm atlanmış olabilir.",
    structureHierarchy: "«{title}» bir alt başlık ama üstünde ana bölüm başlığı yok; başlık düzeni kopuk görünüyor.",
    structureInconsistent: "Bölüm başlıkları farklı biçimlerde yazılmış ({styles}). Tek bir biçimde tutmak daha düzenli görünür.",
    structureStyleBolum: "«Bölüm 1» biçimi",
    structureStyleNumeric: "«1.» biçimi",
    structureStyleCaps: "BÜYÜK HARF",
    structureStylePlain: "düz başlık",
    structureCompletenessHeading: "Bütünlük",
    structureIntro: "Giriş",
    structureConclusion: "Sonuç",
    structurePresent: "var",
    structureMissing: "yok",
    structureCompletenessHint: "Belirgin bir giriş/sonuç bölümü olup olmadığını gösterir. Kurgu kitaplarında bunların olmaması olağandır.",
    prepCta: "Yayına hazırlık",
    prepHint: "Tipografik düzeltmeler: akıllı tırnak, üç nokta, tire (yerel, ücretsiz). Her birini ayrı uygulayabilirsiniz.",
    prepNone: "Yayına hazırlık açısından düzeltilecek bir şey görünmüyor. Tipografi temiz.",
    prepApply: "Uygula",
    prepApplyAll: "Tümünü uygula",
    prepCount: "{count} yer",
    prepQuotesTitle: "Düz tırnak",
    prepQuotesDesc: "Düz çift tırnaklar (\") kitap için tipografik tırnağa (“ ”) çevrilir.",
    prepEllipsisTitle: "Üç nokta",
    prepEllipsisDesc: "Üç ayrı nokta (...) tek üç nokta karakterine (…) çevrilir.",
    prepDashRangeTitle: "Sayı aralığı tiresi",
    prepDashRangeDesc: "Sayılar arasındaki kısa tire (12-15) uzun tireye (12–15) çevrilir.",
    prepDialogueTitle: "Konuşma çizgisi",
    prepDialogueDesc: "Satır başındaki kısa tire konuşma çizgisine (—) çevrilir. Madde listeniz varsa bunu uygulamayın.",
    riskCta: "Riskli içerik",
    riskHint: "Yalnız ciddi riskleri arar: iftira, kişisel veri, telif, kesin tıbbi/hukuki iddia. Hafif küfür/hakaret göz ardı edilir. Hukuki danışmanlık değildir, yalnız dikkat çeker.",
    risking: "Riskler taranıyor…",
    riskNone: "Belirgin bir risk bulunamadı.",
    catDefamation: "Hakaret/İftira",
    catPrivacy: "Kişisel veri",
    catCopyright: "Telif",
    catClaim: "Kesin iddia",
    catMisinfo: "Yanlış bilgi",
    genreLabel: "Kitap türü",
    genreFiction: "Roman / Öykü",
    genreSelfhelp: "Kişisel gelişim",
    genreAcademic: "Akademik",
    genreCta: "Türe göre kontrol",
    genreLoading: "Türe göre bakılıyor…",
    genreHint: "Seçtiğiniz türe özel bakar. Roman: karakter, zaman, olay örgüsü tutarlılığı. Kişisel gelişim: abartılı vaat, tekrar, uygulama adımı. Akademik: kaynak, tanım, nesnellik.",
    genreNone: "Türe özel belirgin bir nokta bulunamadı.",
    catCharacter: "Karakter",
    catTimeline: "Zaman/Olay sırası",
    catPlot: "Olay örgüsü",
    catPromise: "Abartılı vaat",
    catAction: "Uygulama adımı",
    catCitation: "Kaynak",
    catDefinition: "Tanım/Kavram",
    catObjectivity: "Nesnellik",
    errorGeneric: "Bir sorun oluştu. Lütfen tekrar deneyin.",
    errorNoKey:
      "Yapay zekâ anahtarı henüz ayarlanmamış. Kurulum için .env.local dosyasına ANTHROPIC_API_KEY eklenmeli.",
    errorBadKey: "Yapay zekâ anahtarı geçersiz görünüyor. Lütfen kontrol edin.",
    errorRateLimit: "Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.",
    errorTooLong:
      "Metin şimdilik çok uzun (en çok {max} karakter). Kısaltıp tekrar deneyin.",
  },
  publishStudio: {
    tagline: "E-KİTAP & SESLİ KİTAP",
    title: "Kitabını yayına hazırla",
    ebookTagline: "E-KİTAP",
    ebookTitle: "E-kitabını oluştur",
    audiobookTagline: "SESLİ KİTAP",
    audiobookTitle: "Sesli kitabını oluştur",
    textHeading: "Kitap metni",
    textLabel: "Metni buraya yapıştırın",
    textPlaceholder: "Kitabınızın tüm metnini buraya yapıştırın. Bölüm başlıklarını ayrı satıra yazın; uygulama bölümleri kendiliğinden tanır.",
    sampleCta: "Örnek metin",
    clearCta: "Temizle",
    statsWords: "kelime",
    statsChars: "karakter",
    wordCta: "Word'den al (.docx)",
    wordImporting: "Aktarılıyor…",
    wordImportedInfo: "Word belgesi aktarıldı: {paragraphs} paragraf.",
    wordError: "Belge okunamadı. Dosyanın .docx olduğundan emin olun.",
    transferHint: "İpucu: Editör veya mizanpajda hazırladığınız metni aktarma özelliği yakında eklenecek.",
    formatsHeading: "E-kitap formatları",
    formatEpub: "EPUB",
    formatEpubDesc: "En yaygın e-kitap formatı. Apple Books, Google Play Books, Kobo ve birçok cihaz okur.",
    formatKindle: "Kindle (Amazon)",
    formatKindleDesc: "Amazon KDP artık doğrudan EPUB kabul ediyor; KDP'ye uygun dosya üretilir.",
    formatPdf: "PDF (akan metin)",
    formatPdfDesc: "Yazı boyutu okunabilir, ekrana uyan bir PDF e-kitap.",
    formatSoon: "yakında",
    metaHeading: "Kitap bilgileri",
    bookTitleLabel: "Kitap adı",
    bookTitlePlaceholder: "Örn. İmkânsız Bahçe",
    bookAuthorLabel: "Yazar",
    bookAuthorPlaceholder: "Örn. Ada Yılmaz",
    coverHeading: "Kapak görseli",
    coverHint: "JPG veya PNG. Dik (portre) ve en az 1600 px yüksekliğinde olması önerilir. Kapak, e-kitabın ilk sayfası olur.",
    coverCta: "Kapak görseli seç",
    coverChangeCta: "Kapağı değiştir",
    coverRemoveCta: "Kaldır",
    coverFormatError: "Lütfen JPG veya PNG bir görsel seçin.",
    untitledBook: "Adsız Kitap",
    tocTitle: "İçindekiler",
    buildEbookCta: "E-kitap oluştur ve indir",
    building: "Oluşturuluyor…",
    epubDoneNote: "Seçtiğiniz dosyalar hazır — indirilenler klasörünüze kaydedildi.",
    epubErrorNote: "Dosyalar oluşturulamadı. Lütfen metni kontrol edip tekrar deneyin.",
    audioHeading: "Sesli kitap",
    audioAi: "Yapay zekâ sesi",
    audioAiDesc: "Metni doğal bir insan sesiyle okutun. Mikrofon gerekmez. Her bölüm ayrı seslendirilir; her üretim kredi harcar.",
    audioOwn: "Kendi sesimi yüklerim",
    audioOwnDesc: "Siz veya bir seslendirmen okur; ses dosyalarını yükler, bölümlere göre düzenleriz.",
    buildAudioCta: "Sesli kitap oluştur",
    comingSoonNote: "Bu adım bir sonraki aşamada aktif olacak.",
    audioEngineLabel: "Ses motoru",
    audioEngines: [
      {
        id: "minimax",
        name: "MiniMax (Türkçe seslere uygun)",
        desc: "Türkçeye özel sesler içerir; dengeli kredi.",
      },
      {
        id: "elevenlabs",
        name: "ElevenLabs v3 (çok doğal)",
        desc: "Çok doğal ve anlatımlı; 70+ dil. Kredisi biraz daha yüksek olabilir.",
      },
    ],
    audioVoiceLabel: "Ses seçimi",
    audioVoices: [
      { id: "Calm_Woman", name: "Sakin kadın" },
      { id: "Turkish_CalmWoman", name: "Türkçe — sakin kadın (yeni)" },
      { id: "Turkish_Trustworthyman", name: "Türkçe — güven veren erkek (yeni)" },
      { id: "Wise_Woman", name: "Olgun / bilge kadın" },
      { id: "Lively_Girl", name: "Genç / canlı kız" },
      { id: "Lovely_Girl", name: "Tatlı kız" },
      { id: "Sweet_Girl_2", name: "Şirin genç kız" },
      { id: "Exuberant_Girl", name: "Coşkulu genç kız" },
      { id: "Inspirational_girl", name: "İlham veren genç kadın" },
      { id: "Friendly_Person", name: "Sıcak / samimi" },
      { id: "Deep_Voice_Man", name: "Tok sesli erkek" },
      { id: "Patient_Man", name: "Sakin erkek" },
      { id: "Casual_Guy", name: "Rahat / günlük erkek" },
      { id: "Decent_Boy", name: "Efendi genç erkek" },
      { id: "Determined_Man", name: "Kararlı erkek" },
      { id: "Young_Knight", name: "Genç ve mert erkek" },
      { id: "Elegant_Man", name: "Zarif beyefendi" },
      { id: "Imposing_Manner", name: "Heybetli / otoriter" },
      { id: "Abbess", name: "Vakur olgun kadın" },
    ],
    audioVoicesEleven: [
      { id: "Rachel", name: "Rachel" },
      { id: "Sarah", name: "Sarah" },
      { id: "Aria", name: "Aria" },
      { id: "Alexandra", name: "Alexandra" },
      { id: "Jane", name: "Jane" },
      { id: "Hope", name: "Hope" },
      { id: "Arabella", name: "Arabella" },
      { id: "Monika", name: "Monika" },
      { id: "Domi", name: "Domi" },
      { id: "Juniper", name: "Juniper" },
      { id: "Priyanka", name: "Priyanka" },
      { id: "Blondie", name: "Blondie" },
      { id: "Drew", name: "Drew" },
      { id: "Paul", name: "Paul" },
      { id: "Roger", name: "Roger" },
      { id: "James", name: "James" },
      { id: "Mark", name: "Mark" },
      { id: "Dave", name: "Dave" },
      { id: "Clyde", name: "Clyde" },
      { id: "Fin", name: "Fin" },
      { id: "Bradford", name: "Bradford" },
      { id: "Reginald", name: "Reginald" },
      { id: "Austin", name: "Austin" },
      { id: "Kuon", name: "Kuon" },
    ],
    audioSpeedLabel: "Okuma hızı",
    audioListenSpeedLabel: "Dinleme hızı",
    audioListenSpeedHint: "Sesi yeniden üretmeden hızlı/yavaş dinletir — kredi harcamaz.",
    audioPreviewCta: "Sesi dene",
    audioPreviewBusy: "Hazırlanıyor…",
    audioPreviewText: "Merhaba, bu seçtiğiniz sesin kısa bir örneğidir. Kitabınız bu tonda okunacak.",
    audioChaptersHeading: "Bölümleri seslendir",
    audioChaptersHint: "Her bölümü tek tek seslendirin, dinleyin ve ses dosyasını indirin. Her seslendirme kredi harcar.",
    audioNarrateCta: "Seslendir",
    audioNarrateBusy: "Seslendiriliyor…",
    audioDownload: "İndir",
    audioCreditNote: "Not: Her seslendirme yapay zekâ kredisi harcar. Önce kısa bir bölümle deneyin.",
    audioTokenError: "Henüz API anahtarı eklenmemiş. .env.local dosyasına Replicate token'ını yapıştırıp sunucuyu yeniden başlatın.",
    audioGenericError: "Ses üretilemedi. Birkaç saniye sonra tekrar deneyin; sorun sürerse anahtarı ve bakiyenizi kontrol edin.",
    audioOwnSoonNote: "Kendi sesinizi yükleme ve kayıt özelliği bir sonraki aşamada aktif olacak.",
    previewHeading: "Kitap önizlemesi",
    previewEmpty: "Metni yapıştırın veya Word'den alın; bölümler ve içindekiler burada görünecek.",
    chaptersFound: "{count} bölüm",
    chapterUntitled: "Başlıksız giriş",
    totalWords: "Toplam {count} kelime",
    previewReady: "Bölümler tanındı. Çıktı üretimi sonraki aşamada bu yapıyı kullanacak.",
  },
  tanitimStudio: {
    tagline: "TANITIM · PAZARLAMA",
    title: "Kitabını tanıt",
    infoHeading: "Kitap bilgileri",
    bookTitleLabel: "Kitap adı",
    bookTitlePlaceholder: "Örn. İmkânsız Bahçe",
    bookAuthorLabel: "Yazar",
    bookAuthorPlaceholder: "Örn. Ada Yılmaz",
    genreLabel: "Tür",
    genrePlaceholder: "Örn. roman, çocuk kitabı, kişisel gelişim",
    audienceLabel: "Hedef okuyucu (isteğe bağlı)",
    audiencePlaceholder: "Örn. genç yetişkinler, yeni ebeveynler",
    summaryLabel: "Kısa özet / konu",
    summaryPlaceholder:
      "Kitabın neyi anlatıyor? Birkaç cümleyle konusunu, ana fikrini ve havasını yaz. Yapay zekâ tanıtım metinlerini buradan üretecek.",
    toneLabel: "Ton",
    tones: [
      { id: "warm", name: "Samimi" },
      { id: "professional", name: "Profesyonel" },
      { id: "inspiring", name: "İlham verici" },
      { id: "playful", name: "Eğlenceli" },
      { id: "serious", name: "Ciddi" },
    ],
    sampleCta: "Örnek bilgi koy",
    clearCta: "Temizle",
    materialsHeading: "Üretilecek malzemeler",
    materialsHint: "İstediklerini seç; yapay zekâ yalnızca işaretlediklerini üretir.",
    matSocial: "Sosyal medya gönderileri",
    matSocialDesc: "Instagram, X/Twitter ve Facebook için hazır metinler + hashtag önerileri.",
    matPress: "Basın / tanıtım bülteni",
    matPressDesc: "Gazete, blog ve yayınevlerine gönderebileceğin profesyonel duyuru.",
    matSales: "Satış sayfası metinleri",
    matSalesDesc: "Amazon/KDP kitap açıklaması ve arka kapak tanıtım yazısı.",
    matSoon: "yakında",
    imageLabel: "Instagram için tanıtım görseli de üret",
    imageHint: "Kare bir tanıtım görseli oluşturulur (kapaktaki gibi, her üretim kredi harcar).",
    generateCta: "Tanıtım malzemelerini üret",
    regenerateCta: "Yeniden üret",
    generating: "Üretiliyor… (~10-20 sn)",
    soonNote: "Instagram görseli bir sonraki adımda eklenecek. Şimdilik metin malzemeleri üretiliyor.",
    previewHeading: "Tanıtım önizlemesi",
    previewEmpty:
      "Soldaki kutulara kitabının bilgilerini gir. Üretilen tanıtım metinleri burada görünecek.",
    previewPlanHeading: "Üretilecekler",
    previewReady: "Bilgiler hazır. ‘Tanıtım malzemelerini üret’ düğmesine bas; metinler burada görünecek.",
    socialHeading: "Sosyal medya gönderileri",
    platformInstagram: "Instagram",
    platformX: "X (Twitter)",
    platformFacebook: "Facebook",
    hashtagsHeading: "Hashtag önerileri",
    pressHeading: "Basın / tanıtım bülteni",
    salesDescHeading: "Satış sayfası açıklaması (Amazon/KDP)",
    backCoverHeading: "Arka kapak tanıtım yazısı",
    copyCta: "Kopyala",
    copiedCta: "Kopyalandı",
    copyAllCta: "Tümünü kopyala",
    imageHeading: "Instagram görseli",
    imageGenerating: "Görsel üretiliyor… (~30-60 sn)",
    downloadCta: "İndir",
    errorNoKey:
      "Yapay zekâ anahtarı henüz ayarlanmamış. Kurulum için .env.local dosyasına ANTHROPIC_API_KEY eklenmeli.",
    errorBadKey: "Yapay zekâ anahtarı geçersiz görünüyor. Lütfen kontrol edin.",
    errorRateLimit: "Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.",
    errorTooLong: "Özet şimdilik çok uzun. Biraz kısaltıp tekrar deneyin.",
    errorGeneric: "Tanıtım üretilemedi. Birkaç saniye sonra tekrar deneyin; sorun sürerse anahtarı ve bakiyeyi kontrol edin.",
    errorNoImageKey:
      "Görsel anahtarı henüz ayarlanmamış. Kurulum için .env.local dosyasına REPLICATE_API_TOKEN eklenmeli.",
    errorImageGeneric: "Görsel üretilemedi. Birkaç saniye sonra tekrar deneyin; sorun sürerse anahtarı ve bakiyeyi kontrol edin.",
  },
  common: {
    back: "Ana sayfaya dön",
    comingSoon: "Yakında",
    open: "Aç",
  },
};

const en: Dictionary = {
  brand: "tipostudio",
  nav: {
    home: "Home",
    cover: "Cover",
    layout: "Layout",
    editor: "AI Editor",
    publish: "E-book",
    audiobook: "Audiobook",
    promo: "Promotion",
    projects: "My Projects",
    login: "Log in",
    signup: "Sign up",
  },
  projelerStudio: {
    heading: "My Projects",
    subtitle: "Your saved book projects. Open, rename, or create a new one.",
    newProject: "New project",
    open: "Open",
    rename: "Rename",
    renamePrompt: "Project name:",
    delete: "Delete",
    deleteConfirm: "Permanently delete this project?",
    empty: "No projects yet.",
    emptyHint: "Press “New project” to create your first book project.",
    importLocal: "Import the design on this device as a project",
    untitled: "Untitled project",
    loadError: "Couldn't load projects. Refresh and try again.",
    creating: "Creating…",
  },
  auth: {
    loginTitle: "Welcome back",
    loginSubtitle: "Log in to continue with your book projects.",
    signupTitle: "Create your account",
    signupSubtitle: "Start preparing your book for free.",
    nameLabel: "Full name",
    namePlaceholder: "Your name",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 8 characters",
    confirmLabel: "Confirm password",
    confirmPlaceholder: "Re-type your password",
    loginCta: "Log in",
    signupCta: "Create account",
    forgot: "Forgot your password?",
    orContinue: "or",
    googleCta: "Continue with Google",
    haveAccount: "Already have an account?",
    noAccount: "Don't have an account?",
    loginLink: "Log in",
    signupLink: "Sign up",
    terms: "By continuing, you agree to the Terms of Service and Privacy Policy.",
    notConnected:
      "The membership system isn't connected yet — this screen is a preview for now. Real sign-in activates in the next step.",
    signOut: "Sign out",
    loggedInAs: "Account",
  },
  home: {
    badge: "Book preparation in one package",
    title: "Prepare your book professionally, end to end",
    subtitle:
      "Cover design, interior layout, and AI-powered editing for authors and publishers — all in one place.",
    intro:
      "Everything you need to produce a book ready to upload to systems like KDP and KDY. Upload your text, fix it, lay out the pages, design the cover, and get a print-ready file.",
    modulesHeading: "Six core modules",
    flowHeading: "How it works",
    flow: [
      "Upload your manuscript",
      "Let the AI editor clean it up",
      "Lay out the interior pages",
      "Design your cover",
      "Download the print-ready file",
    ],
  },
  modules: {
    cover: {
      title: "Cover Generator",
      tagline: "Print-ready covers",
      description:
        "Design professional book covers on a drag-and-drop canvas. KDP dimensions, spine calculation, and barcode handled automatically.",
      features: [
        "Ready-made templates and customization",
        "KDP-compliant bleed / trim / spine",
        "Automatic ISBN barcode",
        "High-resolution PDF export",
      ],
      cta: "Design a cover",
      status: "This module is coming soon — the core canvas engine is being built.",
    },
    layout: {
      title: "Interior Layout",
      tagline: "Print-ready interior pages",
      description:
        "Turn your manuscript into print-ready interior pages with proper typography. Margins, page numbers, and chapter layout handled automatically.",
      features: [
        "Professional typography and line layout",
        "Correct margins and trim sizes",
        "Automatic page numbers and chapter headings",
        "Print-ready PDF export",
      ],
      cta: "Lay out interior",
      status: "This module is coming soon — the most technical part, built with care.",
    },
    editor: {
      title: "AI-Powered Editor",
      tagline: "Smart proofreading",
      description:
        "AI finds grammar mistakes, assesses style, understands paragraph structure, and suggests fixes for inconsistencies.",
      features: [
        "Grammar and spelling checks",
        "Style and readability suggestions",
        "Paragraph and chapter consistency",
        "Contradiction and repetition detection",
      ],
      cta: "Edit your text",
      status: "This module is coming soon — it activates once the AI connection is set up.",
    },
    publish: {
      title: "E-book",
      tagline: "Ready-to-distribute e-book",
      description:
        "Turn your finished book into an e-book (EPUB, Kindle, reflowable PDF). Chapters are detected automatically and a table of contents is built for you.",
      features: [
        "EPUB, Kindle, and reflowable PDF",
        "Automatic chapter and table-of-contents detection",
        "One-click download",
        "KDP / Kindle-ready output",
      ],
      cta: "Create e-book",
      status: "This module is ready — paste your text, pick a format, download.",
    },
    audiobook: {
      title: "Audiobook",
      tagline: "AI-voiced narration",
      description:
        "Narrate your book in a natural human voice. No microphone needed; narrate each chapter separately, then listen and download.",
      features: [
        "Natural AI voice (Turkish included)",
        "Chapter-by-chapter narration and download",
        "Many voice and speed options",
        "Upload your own narration (soon)",
      ],
      cta: "Create audiobook",
      status: "This module is ready — paste your text, pick a voice, narrate.",
    },
    promo: {
      title: "Book Promotion",
      tagline: "AI-powered marketing",
      description:
        "Turn your book's details into social posts, a press release, and sales-page copy in one click. Create an Instagram promo image too.",
      features: [
        "Instagram, X, and Facebook posts + hashtags",
        "Professional press / promo release",
        "Amazon description and back-cover blurb",
        "AI promo image for Instagram",
      ],
      cta: "Create promotion",
      status: "This module is in progress — the book-info form is ready, the AI connection is next.",
    },
  },
  coverStudio: {
    contentHeading: "Cover content",
    titleLabel: "Book title",
    titlePlaceholder: "Your book title",
    authorLabel: "Author",
    authorPlaceholder: "Author name",
    subtitleLabel: "Kicker / genre (optional)",
    subtitlePlaceholder: "e.g. NOVEL",
    isbnLabel: "ISBN number (optional)",
    isbnPlaceholder: "e.g. 978-1-23-456789-7",
    isbnHint: "Enter a 13-digit ISBN to generate a real, scannable barcode on the back cover.",
    isbnValid: "✓ Valid — barcode generated.",
    isbnInvalid: "Invalid ISBN. Check the 13-digit number (placeholder shown).",
    isbnAutoComplete: "✓ Check digit added automatically →",
    isbnRandomCta: "Generate random test ISBN",
    navTemplates: "Template",
    navAi: "AI",
    navContent: "Text",
    navObjects: "Object",
    navColors: "Color",
    navBarcode: "Barcode",
    navImages: "Image",
    navSetup: "Setup",
    navLayers: "Layers",
    navLibrary: "My uploads",
    libraryImagesHeading: "My images",
    libraryImagesHint:
      "Images you upload from your computer and generate with AI are collected here. Click one to use it as the cover or add it as an object.",
    libraryUploadCta: "Upload image",
    libraryEmptyImages:
      "No images yet. Add one with Upload, or generate an image with AI.",
    libraryUseAsCover: "Use as cover",
    libraryAddAsObject: "Add as object",
    libraryDelete: "Delete",
    libraryTemplatesHeading: "My templates",
    libraryTemplatesHint:
      "Save your whole current design (text, colors, positions, objects); then restore it with one click.",
    librarySaveTemplateCta: "Save this design as a template",
    libraryEmptyTemplates:
      "No saved templates yet. Make a design, then tap “Save this design as a template”.",
    libraryApplyTemplate: "Apply",
    libraryTemplateNamePrompt: "Give the template a name:",
    libraryDefaultTemplateName: "My template",
    libraryApplyConfirm:
      "This template will replace your current design. Continue?",
    libraryLocalNote:
      "Note: these are stored only in this browser for now. They'll move to your account once login is connected.",
    barcodeHeading: "Barcode (ISBN)",
    barcodeHint:
      "Enter your ISBN to generate a real, scannable barcode on the back cover.",
    aiHeading: "AI cover artwork",
    aiHint:
      "Pick a style, optionally describe your book in a few words, and let AI generate the artwork. The app overlays your title in its own font.",
    aiModelLabel: "AI model",
    aiModelHint:
      "FLUX: fast and artistic. Nano Banana Pro: follows prompts better, higher quality. Ideogram v3: best at text/typography — ideal for printing the title onto the artwork, but slower and pricier.",
    aiModelFlux: "FLUX 1.1 Pro",
    aiModelNano: "Nano Banana Pro",
    aiModelIdeogram: "Ideogram v3",
    aiEmbedLabel: "Print title & author onto artwork",
    aiEmbedHint:
      "On: the model writes the title and author name directly into the artwork (your own text layers are hidden). Off: generates artwork only, the app overlays the title.",
    aiEmbedOn: "Print on artwork",
    aiEmbedOff: "Artwork only",
    aiEmbedNotice:
      "The title was embedded into the artwork; your own title/author text layers were hidden to avoid duplicates. You can re-show them from the Layers panel.",
    aiStyleLabel: "Style",
    aiScopeLabel: "Scope",
    aiScopeHint:
      "Full wrap: one seamless image across back + spine + front (recommended). Front only: front cover only.",
    aiDescLabel: "Description (optional)",
    aiDescHint: "e.g. ‘a snowy mountain village at night, warm light’. Leave empty to use the style alone.",
    aiDescPlaceholder: "Describe the mood of your book in a few words…",
    aiGenerate: "Generate artwork",
    aiBusy: "Generating… (~10-20s)",
    aiErrorToken:
      "No API key yet. Paste your Replicate token into .env.local and restart the server.",
    aiErrorGeneric:
      "Couldn't generate the image. Try again in a few seconds; if it persists, check your key and balance.",
    aiTip:
      "The generated image is placed as the ‘cover image’. Regenerate if you don't like it, or adjust darkening in the Image panel.",
    elemHeading: "AI design element",
    elemHint:
      "Generates a single element to place on the cover (seal, badge, emblem, ornament). It comes with a transparent background; you can move, resize and duplicate it on the canvas.",
    elemPresetsLabel: "Quick start",
    elemPresetSeal: "Seal",
    elemPresetSealEx:
      "25th anniversary seal, round, elegant frame, fine serif text in the center, gold tones",
    elemPresetBadge: "Badge",
    elemPresetBadgeEx:
      "An elegant ‘Bestseller’ badge with a ribbon banner, classic design",
    elemPresetEmblem: "Emblem",
    elemPresetEmblemEx:
      "Laurel-wreath emblem inside a circle, symmetrical, minimal line design",
    elemPresetOrnament: "Ornament",
    elemPresetOrnamentEx:
      "Thin decorative divider (chapter ornament), symmetrical, elegant",
    elemDescLabel: "What do you want to create?",
    elemDescPlaceholder:
      "e.g. 25th anniversary seal, gold circle, fine elegant serif text in the center",
    elemGenerate: "Create element",
    elemBusyLabel: "Creating… (may take a moment)",
    elemTip:
      "Generation is two steps (draw, then remove the background), so it may take a little longer. Each generation uses credits.",
    aiHistoryHeading: "Recent generations",
    aiHistoryClear: "Clear",
    aiHistoryRestore: "Restore this image",
    aiHistoryHint:
      "The last 6 generations are stored on this device (they survive a refresh). Click one to bring it back to the cover.",
    aiEditCta: "Paint & replace",
    aiEditTitle: "Paint & replace",
    aiEditHint:
      "Paint over the area you want to change or remove, then describe what should appear there. The AI only redraws the painted region.",
    aiEditBrush: "Brush",
    aiEditPromptLabel: "What should appear where you painted?",
    aiEditPromptHint:
      "To remove something, describe the background (e.g. ‘plain wall, empty floor’). To replace it, describe the new thing (e.g. ‘a potted plant’).",
    aiEditPromptPlaceholder: "e.g. empty wooden table",
    aiEditUndo: "Undo",
    aiEditClear: "Clear",
    aiEditCancel: "Cancel",
    aiEditApply: "Apply",
    aiEditBusy: "Working…",
    aiEditNeedMask: "First select the area to change (find it or paint by hand).",
    aiEditNeedPrompt: "Describe what should appear in the selected area.",
    aiEditModeFind: "Type & find",
    aiEditModePaint: "Paint by hand",
    aiEditFindLabel: "Which object should I select?",
    aiEditFindHint:
      "You can type in your own language; it's translated behind the scenes. If it can't find it, try English or switch to ‘Paint by hand’.",
    aiEditFindPlaceholder: "e.g. tree",
    aiEditFindCta: "Find",
    aiEditFinding: "Searching…",
    aiEditFindNotFound:
      "Couldn't find that object. Try another word (or English) or select it yourself with ‘Paint by hand’.",
    aiEditFindFound: "Object found and selected. Now describe what should replace it.",
    aiEditFindAdjust: "Selection area (tight ↔ wide)",
    aiEditFindAdjustHint:
      "If the selection misses the object's edges, move it right (expand); if it spills over, move it left. Press ‘Find’ again after changing.",
    aiEditTagsCta: "Auto-detect objects",
    aiEditTagsBusy: "Scanning objects…",
    aiEditTagsHint:
      "Not sure what to type? Tap this and the AI will list the objects in your image.",
    aiEditTagsHeading: "Tap an object to select it automatically:",
    aiEditTagsEmpty:
      "No clear objects found. Try typing the word yourself.",
    objectsHeading: "Objects",
    objectsHint: "Add your own text and shapes to the canvas.",
    objectsTip:
      "New objects land in the middle of the front cover. Click on the canvas to drag, rotate, recolor/resize or delete them.",
    objAddText: "Text",
    objAddRect: "Rectangle",
    objAddCircle: "Circle",
    objAddLine: "Line",
    objAddTriangle: "Triangle",
    objAddStar: "Star",
    objAddDiamond: "Diamond",
    dividersHeading: "Ready-made dividers",
    dividerDouble: "Double line",
    dividerDot: "Dot & line",
    dividerDiamond: "Diamond rule",
    shapeStyleLabel: "Shape style",
    shapeStyleHint: "Filled, or just an outline (hollow)?",
    shapeStyleFill: "Filled",
    shapeStyleOutline: "Outline only",
    strokeWidthLabel: "Line/border thickness",
    cornerRadiusLabel: "Corner rounding",
    opacityShapeLabel: "Opacity",
    objTextDefault: "Your text",
    objTextLabel: "Text",
    autoContrastLabel: "Auto-adapt text color to the background",
    autoContrastHint:
      "Title and author turn white over dark art and black over light art, with a soft shadow added. Keeps text readable over any image you use.",
    freeTextHeading: "Free text",
    freeTextHint:
      "Select a text on the canvas to edit its font, size and color here.",
    editTextInPanel: "Edit text →",
    structTextHeading: "Selected text",
    structTextHint:
      "You selected the title, author, subtitle or spine text. Change its font, size and color here.",
    structTextReset: "Reset this text to default",
    spineAutoNote:
      "Spine text is built automatically from the title and author. Edit the title or author to change it.",
    geoHeading: "Position & size",
    geoHint: "Enter the selected shape's dimensions in millimetres. Position measures the shape's center from the page's left/top edge.",
    geoWidth: "Width (mm)",
    geoHeight: "Height (mm)",
    geoX: "Horizontal (X, mm)",
    geoY: "Vertical (Y, mm)",
    geoLockAspect: "Keep ratio (width/height together)",
    geoFullHeight: "Full page height",
    geoFitSafe: "Fit to safe area",
    geoFillFront: "Fill front cover",
    geoCenter: "Center it",
    geoEditCta: "Size & position →",
    objColor: "Color",
    textAutoColorNote: "Color auto-adjusts to the cover image for readability.",
    textAutoColorRevert: "Back to automatic color",
    textPanelLabel: "Add a backing panel",
    textPanelHint:
      "Puts a semi-transparent dark panel behind the text — guaranteed legibility on bright/busy backgrounds.",
    objSize: "Size",
    objFont: "Font",
    fontCatSerif: "Serif (literary)",
    fontCatSans: "Sans (modern)",
    fontCatDisplay: "Display",
    fontCatScript: "Handwriting",
    fontCatMono: "Mono",
    objSizeUp: "Grow text",
    objSizeDown: "Shrink text",
    objTextMultilineHint: "Press Enter for a new line.",
    objAlign: "Alignment",
    objAlignLeft: "Align left",
    objAlignCenter: "Center",
    objAlignRight: "Align right",
    objLineSpacing: "Line spacing",
    objLineSpacingUp: "Increase line spacing",
    objLineSpacingDown: "Decrease line spacing",
    objDuplicate: "Duplicate",
    objDuplicateHint: "Create a copy of the selected object",
    objDelete: "Delete",
    deleteSelectedHint:
      "Delete the selected item (Delete key). Template items are hidden and can be restored from the Layers panel.",
    selObjText: "Text",
    selObjRect: "Rectangle",
    selObjCircle: "Circle",
    selObjLine: "Line",
    selObjImage: "AI element",
    selObjTriangle: "Triangle",
    selObjStar: "Star",
    selObjDiamond: "Diamond",
    selObjDivider: "Divider",
    templatesHeading: "Ready-made templates",
    blankHeading: "New design",
    blankButton: "Blank canvas",
    blankHint: "Start from scratch — add your own text, shapes and AI elements.",
    inspectorClose: "Close",
    inspectorEmptyHint: "Select an object to see its settings here.",
    selectionTitle: "Selection",
    colorsHeading: "Colors",
    colorsHint: "Tweak the template's colors however you like.",
    colorsReset: "Template colors",
    colorBg: "Background",
    colorInk: "Text",
    colorAccent: "Accent",
    imagesHeading: "Image and logo",
    coverImageLabel: "Cover image",
    uploadCta: "Upload image",
    changeCta: "Change",
    removeCta: "Remove",
    darkenLabel: "Darken (for legible text)",
    darkenRemove: "Remove darkening",
    opacityLabel: "Opacity",
    opacityHint: "Lower it to fade the image so the background color shows through.",
    scopeLabel: "Where should the image go?",
    scopeFront: "Front cover",
    scopeWrap: "Whole cover",
    coverFitLabel: "Image placement",
    coverFitHint:
      "Fill: covers the whole area, edges may be cropped. Fit: the entire image shows, gaps may remain at the edges.",
    coverFitFill: "Fill (crop)",
    coverFitContain: "Fit (whole image)",
    coverFrameLabel: "Position the image",
    coverFrameHint: "On a full-wrap image, pan/zoom to bring the main subject onto the front cover.",
    coverPanLabel: "Pan horizontally (left ↔ right)",
    coverZoomLabel: "Zoom",
    coverFrameReset: "Reset",
    logoLabel: "Logo",
    logoSizeLabel: "Logo size",
    logoPosLabel: "Logo position",
    logoPosTop: "Top",
    logoPosBottom: "Bottom",
    showGuides: "Show print guides",
    setupHeading: "Book settings",
    sizeLabel: "Book size",
    sizeGroupKdp: "Amazon KDP",
    sizeGroupTr: "Türkiye sizes",
    pageCountLabel: "Page count",
    pageCountHint: "Spine width is calculated from the page count.",
    paperLabel: "Paper weight",
    paperUnit: "gsm",
    bindingLabel: "Binding",
    bindingSoft: "Paperback",
    bindingHard: "Hardcover",
    bleedLabel: "Bleed",
    bleedHint: "Bleed on every edge. KDP uses 3.175 mm; printers often want 3–5 mm.",
    spineHeading: "Spine",
    spineAuto: "Calculated automatically",
    spineManualToggle: "I'll enter the spine manually",
    spineManualLabel: "Spine width (mm)",
    totalSizeLabel: "Full cover size",
    backCover: "Back cover",
    spine: "Spine",
    frontCover: "Front cover",
    bleedNote: "Dashed lines show the bleed and the spine fold positions.",
    exportHeading: "Print-ready PDF",
    exportHint: "Full wrap, 300 DPI, bleed included — ready to send to the printer.",
    exportCta: "Download PDF",
    exportBusy: "Preparing…",
    pngExportCta: "Download PNG",
    downloadMenuCta: "Download",
    downloadPdf: "Download as PDF",
    downloadPng: "Download as PNG",
    downloadShare: "Share",
    downloadSaveTemplate: "Save as template",
    downloadShareUnsupported:
      "Sharing isn't supported in this browser; downloaded a PNG instead.",
    cropMarksLabel: "Add crop marks (cross)",
    cropMarksHint: "Adds corner cut marks for printers. Turn off for KDP/Amazon.",
    editHeading: "Editing",
    editHint: "Drag to move (snaps to center), resize from the corners, rotate with the top handle or the degree box.",
    editSelected: "Selected",
    alignLabel: "Align",
    layerLabel: "Layer",
    layerToBack: "To back",
    layerBackward: "Backward",
    layerForward: "Forward",
    layerToFront: "To front",
    rotateLabel: "Rotate",
    zOrderLabel: "Order",
    zBringToFront: "Bring to front",
    zBringForward: "Bring forward",
    zSendBackward: "Send backward",
    zSendToBack: "Send to back",
    layersHeading: "Layers",
    layersHint: "Reorder with the up/down arrows (top = front). Click a name to select it on the canvas. Hide with the eye, fix with the lock.",
    layersEmpty: "No items yet.",
    layerSelectHint: "Select on canvas",
    layerShow: "Show",
    layerHide: "Hide",
    layerLock: "Lock",
    layerUnlock: "Unlock",
    alignLeft: "Left",
    alignCenter: "Center",
    alignRight: "Right",
    resetPositions: "Reset layout",
    draftSaved: "Draft saved",
    draftSaving: "Saving…",
    draftRestored: "Your previous design was restored.",
    draftNew: "New design",
    draftNewConfirm:
      "This will clear the current design and start fresh. Continue?",
    selTitle: "Title",
    selAuthor: "Author",
    selSubtitle: "Subtitle",
    selLogo: "Logo",
    selRule: "Rule line",
    selFrame: "Frame",
    selEmblem: "Emblem",
    selPanel: "Panel",
    selSpine: "Spine text",
    selBarcode: "Barcode",
    selCover: "Cover image",
    selDarken: "Darkening overlay",
    selBackground: "Background",
    comingNextHeading: "Coming next",
    comingNext: [
      "Customize colors",
      "Print-ready PDF export",
    ],
  },
  layoutStudio: {
    tagline: "Interior design · KDY",
    title: "Layout",
    navBook: "Book",
    navText: "Text",
    navPage: "Page",
    navType: "Type",
    bookHeading: "Book details",
    bookTitleLabel: "Book title",
    bookTitlePlaceholder: "e.g. Silent Streets",
    bookAuthorLabel: "Author",
    bookAuthorPlaceholder: "e.g. Ayşe Demir",
    bookBioLabel: "Author bio",
    bookBioPlaceholder: "A short introduction about the author (optional).",
    bookHint:
      "These details are used on the title page, bio page and running heads.",
    textHeading: "Book text",
    textLabel: "Paste your text here",
    textPlaceholder:
      "Paste your book's text here. Separate paragraphs with a blank line. Use # for a main chapter, ## ### #### for sub-headings, and start a line with > for a quote.",
    textMarkdownHint:
      "# main chapter · ## ### #### sub-headings · > quote. Chapters auto-start on a right page.",
    sampleCta: "Insert sample text",
    clearCta: "Clear",
    statsWords: "words",
    statsChars: "characters",
    sourceManual: "Write manually",
    sourceWord: "Import from Word",
    wordHeading: "Import from a Word file",
    wordDropLabel: "Choose a Word file (.docx)",
    wordModeLabel: "Import style",
    wordModeKdy: "Adapt to KDY layout",
    wordModeKdyHint:
      "Keeps the structure (paragraphs, headings, centered lines, bold/italic) but applies KDY's point size, leading and indents.",
    wordModeFaithful: "Stay faithful to Word",
    wordModeFaithfulHint:
      "Carries over Word's point size, paragraph spacing, first-line indents and blank paragraphs as closely as possible.",
    wordImportCta: "Import document",
    wordReplaceCta: "Import another file",
    wordClearCta: "Remove import",
    wordImporting: "Importing…",
    wordImportedInfo: "Imported {paragraphs} paragraphs · {headings} headings.",
    wordError: "Could not read the document. Is it a valid .docx file?",
    wordHint:
      "Only .docx is supported (not the old .doc). In Word use Save As → .docx to convert.",
    pageHeading: "Page & margins",
    standardLabel: "Print standard",
    standardKdy: "KDY (Kitapyurdu)",
    standardKdp: "Amazon KDP",
    standardIngram: "IngramSpark",
    standardBnpress: "B&N Press",
    standardLulu: "Lulu",
    standardHint:
      "Choosing a standard automatically sets the size, margins, bleed and PDF output to match it.",
    sizeLabel: "Book size",
    sizeGroupKdy: "KDY (Kitapyurdu)",
    sizeGroupKdp: "Inch-based sizes (KDP · Ingram · B&N · Lulu)",
    sizeGroupTr: "Türkiye sizes",
    presetLabel: "Preset",
    presetKdy: "KDY",
    presetKdp: "KDP",
    presetIngram: "Ingram",
    presetBnpress: "B&N",
    presetLulu: "Lulu",
    presetComfortable: "Comfortable",
    presetStandard: "Standard",
    presetCompact: "Compact",
    presetCustom: "Custom",
    marginTop: "Top",
    marginBottom: "Bottom",
    marginInside: "Inside (gutter)",
    marginOutside: "Outside",
    marginsHint:
      "KDY default: top/bottom 20, inside 20, outside 15 mm. The inside edge faces the binding.",
    gutterLabel: "Binding allowance",
    gutterHint:
      "As page count grows the binding takes up more room; this allowance is added to the inside edge.",
    gutterAuto: "Auto-suggest",
    typeHeading: "Type settings",
    fontLabel: "Font",
    fontSizeLabel: "Size (pt)",
    leadingLabel: "Line spacing",
    alignLabel: "Alignment",
    alignLeft: "Left",
    alignJustify: "Justify",
    indentLabel: "Paragraph indent",
    paraSpaceLabel: "Paragraph spacing",
    headingFontLabel: "Heading font",
    detectHeadings: "Auto-detect headings",
    detectHeadingsHint:
      "Lines starting with # or written in UPPERCASE are treated as headings.",
    structureHeading: "Structure",
    frontMatterLabel: "Title + bio + contents",
    chapterRightLabel: "Chapters start on a right page",
    runningHeadsLabel: "Running heads (author / title)",
    pageNumbersLabel: "Page numbers",
    hyphenateLabel: "End-of-line hyphenation (Turkish)",
    dropCapLabel: "Chapter drop cap (large initial)",
    lineBreakLabel: "Line breaking",
    lineBreakBalanced: "Balanced (Knuth–Plass)",
    lineBreakGreedy: "Tight (greedy)",
    tocEditHeading: "Table of contents titles",
    tocEditHint: "Change how each chapter appears in the contents. Leave blank to use the chapter heading. Page numbers stay automatic.",
    tocEntryPlaceholder: "(chapter heading)",
    structureHint:
      "KDY adds the first 2 pages (imprint) automatically; the table of contents is generated for you.",
    roleTitle: "Title page",
    roleBio: "Bio",
    roleToc: "Contents",
    roleBlank: "Blank page",
    previewHeading: "Preview",
    pageCountLabel: "Total",
    pageWord: "pages",
    zoomLabel: "Zoom",
    emptyPreview:
      "Enter the book title and text; the title page, contents and chapters will appear here.",
    exportPdfCta: "Download PDF",
    exportingLabel: "Preparing…",
    exportErrorLabel: "Could not create the PDF. Please try again.",
    cropMarksLabel: "Crop marks + 5 mm bleed",
    bleedLabel: "Add bleed — for edge-to-edge images",
    bleedHint:
      "On: the PDF is produced with 3.175 mm bleed on every edge (for images that run to the edge). Off: the PDF is exactly trim size — simplest for plain text books.",
    kerningLabel: "Letter-spacing refinement (kerning)",
    kerningHint:
      "On: tightens overhanging capitals like V, W, Y, T against their neighbours (e.g. “VA”, “Ta”). Makes the PDF look more professional.",
    exportHint:
      "The interior PDF is produced at 130×195 trim + 5 mm bleed with fonts embedded. Text is black (RGB); the true CMYK conversion KDY expects needs a separate server step.",
    exportHintKdp:
      "The interior PDF is produced at exact trim size, with no crop marks and fonts embedded — the format Amazon KDP expects. If bleed is on, 3.175 mm is added to every edge.",
    exportHintIngram:
      "The interior PDF is produced at exact trim size, with no crop marks and fonts embedded. IngramSpark also requires PDF/X-1a / PDF/X-3; that final conversion (CMYK + PDF/X) is a separate step. If bleed is on, 3.175 mm is added to every edge.",
    imprintNote:
      "KDY adds the first 2 pages (logo + imprint) automatically; they are not in this file. The PDF starts directly with the title page.",
    imprintNoteKdp:
      "On KDP you provide every page yourself. Don't forget to add a copyright/imprint page; the PDF starts with the title page.",
    unitMm: "mm",
    unitPt: "pt",
  },
  editorStudio: {
    tagline: "AI Editor · Proofreading",
    title: "Text Check",
    textHeading: "Book text",
    textLabel: "Paste your text here",
    textPlaceholder:
      "Paste the text you want to check here. The AI will review it for spelling, style and consistency and offer suggestions. The decision is always yours.",
    sampleCta: "Insert sample text",
    clearCta: "Clear",
    statsWords: "words",
    statsChars: "characters",
    wordCta: "Import from Word (.docx)",
    wordImporting: "Importing…",
    wordImportedInfo: "Imported {paragraphs} paragraphs into the text.",
    wordError: "Could not read the document. Is it a valid .docx file?",
    wordHint:
      "Only .docx is supported (not the old .doc). In Word use Save As → .docx to convert. Only the text is imported; formatting and headings aren't preserved.",
    exportDocxCta: "Download as Word",
    exportDocxBusy: "Preparing…",
    exportDocxHint:
      "Downloads your edited text as a .docx file. Each line becomes a paragraph; no rich formatting is added.",
    exportDocxHintKept:
      "Your uploaded Word's formatting (headings, alignment, styles) is preserved; only the corrections you ACCEPTED are written into the file. Structure stays intact for layout.",
    exportDocxDoneKept:
      "Downloaded. Original formatting kept, {count} corrections written into the file.",
    exportDocxDonePlain: "Downloaded (plain-text .docx).",
    exportDocxFilename: "edited-text",
    checkCta: "Check",
    checking: "Checking…",
    reviewCta: "Editorial review",
    reviewing: "Reviewing…",
    reviewHint: "Assesses flow, word choice, sentence structure, dialogue and natural prose (using rules distilled from a master translation); it advises rather than fixes.",
    deepLabel: "Deep check",
    deepHint: "A stronger model that catches even subtle errors, but costs a bit more.",
    resultsHeading: "Suggestions",
    emptyResults:
      "Paste your text into the box on the left. Suggestions — the original phrase, the proposed fix and the reason — will be listed here one by one.",
    resultsCount: "{count} suggestions found",
    noIssues: "No notable issues found. The text looks clean.",
    tidyCount: "{count} extra spaces",
    tidyCta: "Clean up spacing",
    tidyHint: "Removes double spaces, trailing spaces and extra blank lines in one click.",
    catSpelling: "Spelling",
    catGrammar: "Grammar",
    catLong: "Long sentence",
    catRepetition: "Repetition",
    catFlow: "Flow",
    catTone: "Tone",
    catParagraph: "Paragraph",
    catFluency: "Natural flow",
    catSentenceStructure: "Sentence structure",
    catDiction: "Word choice",
    catDialogue: "Dialogue",
    catConcision: "Concision",
    catClarity: "Clarity",
    catRegister: "Register",
    catPunctuation: "Punctuation",
    severityWarn: "Important",
    severitySuggest: "Suggestion",
    severityHint: "Light",
    longExplain: "This sentence is long ({count} words). It may be hard to read; consider splitting it.",
    origLabel: "Was",
    fixLabel: "Fix",
    contextLabel: "Where it appears",
    revealCta: "Show its location",
    acceptCta: "Accept",
    rejectCta: "Ignore",
    dismissCta: "OK, got it",
    accepted: "Fixed",
    appliedNote: "This fix was applied to your text.",
    rejected: "Ignored",
    dismissed: "Seen",
    structureCta: "Book structure",
    structureHint: "Extracts chapters, their lengths and structural issues (local, free).",
    structureOutline: "Outline",
    structureFound: "{count} chapters found",
    structureNone: "No clear chapter headings found. If you put each chapter title on its own line (e.g. “Chapter 1”), I can map the structure.",
    structureUntitled: "(untitled opening)",
    structureIssuesHeading: "Structure notes",
    structureTooLong: "«{title}» is much longer than the others ({words} words, average {avg}).",
    structureTooShort: "«{title}» is much shorter than the others ({words} words, average {avg}).",
    structureGap: "Chapter numbers don't look consecutive; a chapter may be missing.",
    structureHierarchy: "«{title}» is a sub-heading but has no main chapter heading above it; the heading order looks broken.",
    structureInconsistent: "Chapter headings use different styles ({styles}). Keeping a single style looks tidier.",
    structureStyleBolum: "«Chapter 1» style",
    structureStyleNumeric: "«1.» style",
    structureStyleCaps: "ALL CAPS",
    structureStylePlain: "plain title",
    structureCompletenessHeading: "Completeness",
    structureIntro: "Intro",
    structureConclusion: "Conclusion",
    structurePresent: "yes",
    structureMissing: "no",
    structureCompletenessHint: "Shows whether there's a clear intro/conclusion. In fiction it's normal not to have them.",
    prepCta: "Publish prep",
    prepHint: "Typographic fixes: smart quotes, ellipsis, dashes (local, free). Apply each one separately.",
    prepNone: "Nothing to fix for publishing. Typography looks clean.",
    prepApply: "Apply",
    prepApplyAll: "Apply all",
    prepCount: "{count} places",
    prepQuotesTitle: "Straight quotes",
    prepQuotesDesc: "Straight double quotes (\") are converted to typographic quotes (“ ”) for the book.",
    prepEllipsisTitle: "Three dots",
    prepEllipsisDesc: "Three separate dots (...) become a single ellipsis character (…).",
    prepDashRangeTitle: "Range dash",
    prepDashRangeDesc: "A hyphen between numbers (12-15) becomes an en dash (12–15).",
    prepDialogueTitle: "Dialogue dash",
    prepDialogueDesc: "A hyphen at the start of a line becomes a dialogue dash (—). Skip this if you have bullet lists.",
    riskCta: "Risky content",
    riskHint: "Flags only serious risks: defamation, personal data, copyright, definitive medical/legal claims. Mild profanity/insults are ignored. Not legal advice — it only raises a flag.",
    risking: "Scanning for risks…",
    riskNone: "No clear risk found.",
    catDefamation: "Defamation",
    catPrivacy: "Personal data",
    catCopyright: "Copyright",
    catClaim: "Strong claim",
    catMisinfo: "Misinformation",
    genreLabel: "Book genre",
    genreFiction: "Fiction / Story",
    genreSelfhelp: "Self-help",
    genreAcademic: "Academic",
    genreCta: "Genre check",
    genreLoading: "Checking by genre…",
    genreHint: "Looks at genre-specific issues. Fiction: character, timeline, plot consistency. Self-help: overblown promises, repetition, action steps. Academic: citations, definitions, objectivity.",
    genreNone: "No clear genre-specific issue found.",
    catCharacter: "Character",
    catTimeline: "Timeline",
    catPlot: "Plot",
    catPromise: "Overblown promise",
    catAction: "Action step",
    catCitation: "Citation",
    catDefinition: "Definition",
    catObjectivity: "Objectivity",
    errorGeneric: "Something went wrong. Please try again.",
    errorNoKey:
      "The AI key isn't set up yet. Add ANTHROPIC_API_KEY to the .env.local file to enable it.",
    errorBadKey: "The AI key seems invalid. Please check it.",
    errorRateLimit: "Too many requests. Please wait a moment and try again.",
    errorTooLong:
      "The text is too long for now (max {max} characters). Shorten it and try again.",
  },
  publishStudio: {
    tagline: "E-BOOK & AUDIOBOOK",
    title: "Get your book ready to publish",
    ebookTagline: "E-BOOK",
    ebookTitle: "Create your e-book",
    audiobookTagline: "AUDIOBOOK",
    audiobookTitle: "Create your audiobook",
    textHeading: "Book text",
    textLabel: "Paste your text here",
    textPlaceholder: "Paste your book's full text here. Put chapter titles on their own line; the app detects chapters automatically.",
    sampleCta: "Sample text",
    clearCta: "Clear",
    statsWords: "words",
    statsChars: "characters",
    wordCta: "Import from Word (.docx)",
    wordImporting: "Importing…",
    wordImportedInfo: "Word document imported: {paragraphs} paragraphs.",
    wordError: "Couldn't read the document. Make sure it's a .docx file.",
    transferHint: "Tip: importing text prepared in the editor or layout module is coming soon.",
    formatsHeading: "E-book formats",
    formatEpub: "EPUB",
    formatEpubDesc: "The most common e-book format. Read by Apple Books, Google Play Books, Kobo, and many devices.",
    formatKindle: "Kindle (Amazon)",
    formatKindleDesc: "Amazon KDP now accepts EPUB directly; a KDP-ready file is produced.",
    formatPdf: "PDF (reflowable)",
    formatPdfDesc: "A readable, screen-fitting PDF e-book with adjustable text.",
    formatSoon: "soon",
    metaHeading: "Book details",
    bookTitleLabel: "Book title",
    bookTitlePlaceholder: "e.g. The Impossible Garden",
    bookAuthorLabel: "Author",
    bookAuthorPlaceholder: "e.g. Ada Smith",
    coverHeading: "Cover image",
    coverHint: "JPG or PNG. Portrait orientation and at least 1600 px tall is recommended. The cover becomes the first page of the e-book.",
    coverCta: "Choose cover image",
    coverChangeCta: "Change cover",
    coverRemoveCta: "Remove",
    coverFormatError: "Please choose a JPG or PNG image.",
    untitledBook: "Untitled Book",
    tocTitle: "Table of Contents",
    buildEbookCta: "Create & download e-book",
    building: "Creating…",
    epubDoneNote: "Your selected files are ready — saved to your downloads folder.",
    epubErrorNote: "Couldn't create the files. Please check the text and try again.",
    audioHeading: "Audiobook",
    audioAi: "AI voice",
    audioAiDesc: "Have the text read in a natural human voice. No microphone needed. Each chapter is narrated separately; every generation uses credits.",
    audioOwn: "Upload my own voice",
    audioOwnDesc: "You or a narrator record it; upload the audio files and we arrange them by chapter.",
    buildAudioCta: "Create audiobook",
    comingSoonNote: "This step activates in the next phase.",
    audioEngineLabel: "Voice engine",
    audioEngines: [
      {
        id: "minimax",
        name: "MiniMax (good Turkish voices)",
        desc: "Includes Turkish-specific voices; balanced credit cost.",
      },
      {
        id: "elevenlabs",
        name: "ElevenLabs v3 (very natural)",
        desc: "Very natural and expressive; 70+ languages. Credit cost may be a bit higher.",
      },
    ],
    audioVoiceLabel: "Voice",
    audioVoices: [
      { id: "Calm_Woman", name: "Calm woman" },
      { id: "Turkish_CalmWoman", name: "Turkish — calm woman (new)" },
      { id: "Turkish_Trustworthyman", name: "Turkish — trustworthy man (new)" },
      { id: "Wise_Woman", name: "Wise / mature woman" },
      { id: "Lively_Girl", name: "Young / lively girl" },
      { id: "Lovely_Girl", name: "Lovely girl" },
      { id: "Sweet_Girl_2", name: "Sweet young girl" },
      { id: "Exuberant_Girl", name: "Exuberant girl" },
      { id: "Inspirational_girl", name: "Inspirational young woman" },
      { id: "Friendly_Person", name: "Warm / friendly" },
      { id: "Deep_Voice_Man", name: "Deep-voiced man" },
      { id: "Patient_Man", name: "Calm man" },
      { id: "Casual_Guy", name: "Casual guy" },
      { id: "Decent_Boy", name: "Decent young man" },
      { id: "Determined_Man", name: "Determined man" },
      { id: "Young_Knight", name: "Young, gallant man" },
      { id: "Elegant_Man", name: "Elegant gentleman" },
      { id: "Imposing_Manner", name: "Imposing / authoritative" },
      { id: "Abbess", name: "Dignified mature woman" },
    ],
    audioVoicesEleven: [
      { id: "Rachel", name: "Rachel" },
      { id: "Sarah", name: "Sarah" },
      { id: "Aria", name: "Aria" },
      { id: "Alexandra", name: "Alexandra" },
      { id: "Jane", name: "Jane" },
      { id: "Hope", name: "Hope" },
      { id: "Arabella", name: "Arabella" },
      { id: "Monika", name: "Monika" },
      { id: "Domi", name: "Domi" },
      { id: "Juniper", name: "Juniper" },
      { id: "Priyanka", name: "Priyanka" },
      { id: "Blondie", name: "Blondie" },
      { id: "Drew", name: "Drew" },
      { id: "Paul", name: "Paul" },
      { id: "Roger", name: "Roger" },
      { id: "James", name: "James" },
      { id: "Mark", name: "Mark" },
      { id: "Dave", name: "Dave" },
      { id: "Clyde", name: "Clyde" },
      { id: "Fin", name: "Fin" },
      { id: "Bradford", name: "Bradford" },
      { id: "Reginald", name: "Reginald" },
      { id: "Austin", name: "Austin" },
      { id: "Kuon", name: "Kuon" },
    ],
    audioSpeedLabel: "Reading speed",
    audioListenSpeedLabel: "Listening speed",
    audioListenSpeedHint: "Plays faster/slower without regenerating — uses no credits.",
    audioPreviewCta: "Try the voice",
    audioPreviewBusy: "Preparing…",
    audioPreviewText: "Hello, this is a short sample of the voice you picked. Your book will be read in this tone.",
    audioChaptersHeading: "Narrate chapters",
    audioChaptersHint: "Narrate each chapter one by one, listen, and download the audio file. Each narration uses credits.",
    audioNarrateCta: "Narrate",
    audioNarrateBusy: "Narrating…",
    audioDownload: "Download",
    audioCreditNote: "Note: each narration uses AI credits. Try a short chapter first.",
    audioTokenError: "No API key added yet. Paste your Replicate token into .env.local and restart the server.",
    audioGenericError: "Couldn't generate audio. Try again in a few seconds; if it persists, check your key and balance.",
    audioOwnSoonNote: "Uploading and recording your own voice activates in the next phase.",
    previewHeading: "Book preview",
    previewEmpty: "Paste your text or import from Word; chapters and the table of contents will appear here.",
    chaptersFound: "{count} chapters",
    chapterUntitled: "Untitled opening",
    totalWords: "{count} words total",
    previewReady: "Chapters detected. Output generation will use this structure in the next phase.",
  },
  tanitimStudio: {
    tagline: "PROMOTION · MARKETING",
    title: "Promote your book",
    infoHeading: "Book details",
    bookTitleLabel: "Book title",
    bookTitlePlaceholder: "e.g. The Impossible Garden",
    bookAuthorLabel: "Author",
    bookAuthorPlaceholder: "e.g. Ada Smith",
    genreLabel: "Genre",
    genrePlaceholder: "e.g. novel, children's book, self-help",
    audienceLabel: "Target reader (optional)",
    audiencePlaceholder: "e.g. young adults, new parents",
    summaryLabel: "Short summary / topic",
    summaryPlaceholder:
      "What is your book about? Write a few sentences on its subject, main idea and mood. The AI will generate the promo copy from this.",
    toneLabel: "Tone",
    tones: [
      { id: "warm", name: "Warm" },
      { id: "professional", name: "Professional" },
      { id: "inspiring", name: "Inspiring" },
      { id: "playful", name: "Playful" },
      { id: "serious", name: "Serious" },
    ],
    sampleCta: "Insert sample info",
    clearCta: "Clear",
    materialsHeading: "Materials to generate",
    materialsHint: "Pick what you want; the AI generates only what you check.",
    matSocial: "Social media posts",
    matSocialDesc: "Ready-made copy for Instagram, X/Twitter and Facebook + hashtag suggestions.",
    matPress: "Press / promo release",
    matPressDesc: "A professional announcement to send to newspapers, blogs and publishers.",
    matSales: "Sales-page copy",
    matSalesDesc: "Amazon/KDP book description and back-cover blurb.",
    matSoon: "soon",
    imageLabel: "Also create an Instagram promo image",
    imageHint: "A square promo image is generated (like the cover module; each generation uses credits).",
    generateCta: "Generate promo materials",
    regenerateCta: "Regenerate",
    generating: "Generating… (~10-20s)",
    soonNote: "The Instagram image comes in the next step. For now, text materials are generated.",
    previewHeading: "Promotion preview",
    previewEmpty:
      "Enter your book's details in the boxes on the left. The generated promo copy will appear here.",
    previewPlanHeading: "Will be generated",
    previewReady: "Details ready. Press ‘Generate promo materials’ and the copy will appear here.",
    socialHeading: "Social media posts",
    platformInstagram: "Instagram",
    platformX: "X (Twitter)",
    platformFacebook: "Facebook",
    hashtagsHeading: "Hashtag suggestions",
    pressHeading: "Press release",
    salesDescHeading: "Sales-page description (Amazon/KDP)",
    backCoverHeading: "Back-cover blurb",
    copyCta: "Copy",
    copiedCta: "Copied",
    copyAllCta: "Copy all",
    imageHeading: "Instagram image",
    imageGenerating: "Generating image… (~30-60s)",
    downloadCta: "Download",
    errorNoKey:
      "The AI key isn't set up yet. Add ANTHROPIC_API_KEY to the .env.local file to enable it.",
    errorBadKey: "The AI key seems invalid. Please check it.",
    errorRateLimit: "Too many requests. Please wait a moment and try again.",
    errorTooLong: "The summary is too long for now. Shorten it a bit and try again.",
    errorGeneric: "Couldn't generate the promotion. Try again in a few seconds; if it persists, check your key and balance.",
    errorNoImageKey:
      "The image key isn't set up yet. Add REPLICATE_API_TOKEN to the .env.local file to enable it.",
    errorImageGeneric: "Couldn't generate the image. Try again in a few seconds; if it persists, check your key and balance.",
  },
  common: {
    back: "Back to home",
    comingSoon: "Coming soon",
    open: "Open",
  },
};

const dictionaries: Record<Locale, Dictionary> = { tr, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
