import { Fragment } from "react";
import { Icon } from "@/components/Icon";
import { assets } from "@/data/legacy";
import type { GuideSection, Language, LegacyBeginnerData, LegacyGuideData, LegacySbtItem, LocalizedText } from "@/types";

const SECTION_TYPES: Array<NonNullable<GuideSection["type"]>> = ["intro", "steps", "imageText", "cards", "sbtChecklist", "ratings"];
const SECTION_LAYOUTS: Array<NonNullable<GuideSection["layout"]>> = ["image-left", "image-right", "image-top"];

interface WikiInlineEditorProps {
  data: LegacyBeginnerData;
  lang: Language;
  message: string;
  onCancel: () => void;
  onChange: (data: LegacyBeginnerData) => void;
  onSave: () => void;
  saving: boolean;
  topicId: string;
}

interface EditableTextProps {
  className?: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
  value?: string;
}

export function EditableText({ className = "", multiline = false, onCommit, value = "" }: EditableTextProps) {
  return <span
    className={`community-hub-wiki-editable${multiline ? " is-multiline" : ""}${className ? ` ${className}` : ""}`}
    contentEditable
    onBlur={(event) => onCommit(String(event.currentTarget.textContent ?? "").trim())}
    onKeyDown={(event) => {
      if (!multiline && event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    }}
    spellCheck
    suppressContentEditableWarning
  >{value}</span>;
}

function clone(data: LegacyBeginnerData): LegacyBeginnerData {
  return structuredClone(data);
}

function localized(value: string | LocalizedText | undefined, lang: Language): string {
  if (typeof value === "string") return value;
  return value?.[lang] ?? value?.["zh-Hant"] ?? value?.en ?? "";
}

function setLocalized(target: Record<string, unknown>, key: string, lang: Language, value: string) {
  const current = target[key];
  target[key] = typeof current === "object" && current && !Array.isArray(current)
    ? { ...(current as LocalizedText), [lang]: value }
    : { [lang]: value };
}

function EditorButton({ icon, label, onClick, tone = "default" }: { icon: string; label: string; onClick: () => void; tone?: "default" | "danger" }) {
  return <button type="button" className={`community-hub-wiki-icon-button${tone === "danger" ? " is-danger" : ""}`} onClick={onClick} title={label} aria-label={label}><Icon name={icon} /></button>;
}

function PairRows({ rows, onChange }: { rows: Array<[string, string]>; onChange: (rows: Array<[string, string]>) => void }) {
  return <div className="community-hub-wiki-pair-editor">
    {rows.map(([title, body], index) => <div key={index} className="community-hub-wiki-pair-row">
      <EditableText value={title} onCommit={(value) => onChange(rows.map((row, rowIndex) => rowIndex === index ? [value, row[1]] : row))} />
      <EditableText multiline value={body} onCommit={(value) => onChange(rows.map((row, rowIndex) => rowIndex === index ? [row[0], value] : row))} />
      <EditorButton icon="trash-2" label="移除項目" tone="danger" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} />
    </div>)}
    <button type="button" className="community-hub-wiki-add-row" onClick={() => onChange([...rows, ["新項目", "在這裡輸入內容"]])}><Icon name="plus" />新增項目</button>
  </div>;
}

function TextRows({ rows, onChange }: { rows: string[]; onChange: (rows: string[]) => void }) {
  return <div className="community-hub-wiki-text-editor">
    {rows.map((row, index) => <div key={index} className="community-hub-wiki-text-row">
      <EditableText multiline value={row} onCommit={(value) => onChange(rows.map((item, rowIndex) => rowIndex === index ? value : item))} />
      <EditorButton icon="trash-2" label="移除重點" tone="danger" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} />
    </div>)}
    <button type="button" className="community-hub-wiki-add-row" onClick={() => onChange([...rows, "新增重點"])}><Icon name="plus" />新增重點</button>
  </div>;
}

function SectionEditor({ data, index, lang, onChange, topics }: { data: LegacyBeginnerData; index: number; lang: Language; onChange: (data: LegacyBeginnerData) => void; topics: Array<{ id: string; title: string }> }) {
  const guide = data.guides?.[lang];
  const section = guide?.sections?.[index];
  if (!guide || !section) return null;
  const update = (recipe: (target: GuideSection) => void) => {
    const next = clone(data);
    const target = next.guides?.[lang]?.sections?.[index];
    if (!target) return;
    recipe(target);
    onChange(next);
  };
  const move = (direction: -1 | 1) => {
    const next = clone(data);
    const rows = next.guides?.[lang]?.sections;
    if (!rows) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    [rows[index], rows[targetIndex]] = [rows[targetIndex], rows[index]];
    onChange(next);
  };
  const remove = () => {
    const next = clone(data);
    next.guides?.[lang]?.sections?.splice(index, 1);
    onChange(next);
  };
  const image = section.imageUrl || (Number.isInteger(section.image) ? assets.guideAsset(data.images?.[section.image ?? 0]) : "");
  const pairField = section.type === "sbtChecklist" ? "primer" : "items";
  const pairRows = (section[pairField] ?? []) as Array<[string, string]>;
  return <section className={`community-hub-guide-section community-hub-wiki-section-editor${image ? " has-media" : ""} is-layout-${section.layout || "image-left"}`}>
    <div className="community-hub-wiki-section-controls">
      <select value={section.type || "intro"} aria-label="段落類型" onChange={(event) => update((target) => { target.type = event.target.value as GuideSection["type"]; })}>{SECTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <select value={section.topic || "start"} aria-label="段落分類" onChange={(event) => update((target) => { target.topic = event.target.value; })}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
      <select value={section.layout || "image-left"} aria-label="圖片位置" onChange={(event) => update((target) => { target.layout = event.target.value as GuideSection["layout"]; })}>{SECTION_LAYOUTS.map((layout) => <option key={layout} value={layout}>{layout}</option>)}</select>
      <EditorButton icon="arrow-up" label="段落上移" onClick={() => move(-1)} />
      <EditorButton icon="arrow-down" label="段落下移" onClick={() => move(1)} />
      <EditorButton icon="trash-2" label="刪除段落" tone="danger" onClick={remove} />
    </div>
    <div>
      <h3><EditableText value={section.title} onCommit={(value) => update((target) => { target.title = value; })} /></h3>
      {section.introTitle !== undefined ? <p className="community-hub-section-index"><EditableText value={section.introTitle} onCommit={(value) => update((target) => { target.introTitle = value; })} /></p> : null}
      {section.text !== undefined ? <p className="community-hub-guide-copy"><EditableText multiline value={section.text} onCommit={(value) => update((target) => { target.text = value; })} /></p> : null}
      {section.intro !== undefined ? <p className="community-hub-guide-copy"><EditableText multiline value={section.intro} onCommit={(value) => update((target) => { target.intro = value; })} /></p> : null}
      {section.type === "intro" || section.type === "sbtChecklist" || section.bullets?.length ? <TextRows rows={section.bullets ?? []} onChange={(rows) => update((target) => { target.bullets = rows; })} /> : null}
      {section.type === "steps" || section.type === "cards" || section.type === "ratings" || section.type === "sbtChecklist" ? <PairRows rows={pairRows} onChange={(rows) => update((target) => { target[pairField] = rows; })} /> : null}
    </div>
    <div className="community-hub-wiki-media-editor">
      {image ? <figure className="community-hub-guide-media"><img src={image} alt="" /></figure> : <div className="community-hub-wiki-empty-media"><Icon name="image-plus" /><span>尚未設定圖片</span></div>}
      <label><span>圖片網址</span><input type="url" value={section.imageUrl ?? ""} onChange={(event) => update((target) => { target.imageUrl = event.target.value; })} placeholder="https://..." /></label>
      <label><span>素材編號</span><input type="number" min="0" value={section.image ?? 0} onChange={(event) => update((target) => { target.image = Number(event.target.value || 0); })} /></label>
    </div>
  </section>;
}

function OverviewEditor({ data, lang, onChange }: Pick<WikiInlineEditorProps, "data" | "lang" | "onChange">) {
  const guide = data.guides?.[lang];
  if (!guide) return null;
  const updateGuide = (recipe: (target: LegacyGuideData) => void) => {
    const next = clone(data);
    const target = next.guides?.[lang];
    if (!target) return;
    recipe(target);
    onChange(next);
  };
  const cover = assets.guideAsset(data.images?.[0]) || data.images?.[0] || "";
  return <section className="community-hub-guide-overview is-wiki-editing">
    <div className="community-hub-wiki-media-editor">
      {cover ? <figure className="community-hub-guide-cover"><img src={cover} alt="" /></figure> : null}
      <label><span>封面圖片網址</span><input value={data.images?.[0] ?? ""} onChange={(event) => { const next = clone(data); next.images = [...(next.images ?? [])]; next.images[0] = event.target.value; onChange(next); }} /></label>
    </div>
    <div className="community-hub-guide-overview-copy">
      <p className="community-hub-section-index"><EditableText value={guide.eyebrow} onCommit={(value) => updateGuide((target) => { target.eyebrow = value; })} /></p>
      <h3><EditableText value={guide.title} onCommit={(value) => updateGuide((target) => { target.title = value; })} /></h3>
      <p><EditableText multiline value={guide.subtitle} onCommit={(value) => updateGuide((target) => { target.subtitle = value; })} /></p>
    </div>
    <dl className="community-hub-guide-stats">
      {(guide.stats ?? []).map(([label, value], index) => <div key={index} className="community-hub-wiki-stat"><dt><EditableText value={label} onCommit={(nextLabel) => updateGuide((target) => { if (target.stats?.[index]) target.stats[index][0] = nextLabel; })} /></dt><dd><EditableText value={value} onCommit={(nextValue) => updateGuide((target) => { if (target.stats?.[index]) target.stats[index][1] = nextValue; })} /></dd><EditorButton icon="trash-2" label="移除首頁重點" tone="danger" onClick={() => updateGuide((target) => { target.stats = target.stats?.filter((_, rowIndex) => rowIndex !== index) ?? []; })} /></div>)}
      <button type="button" className="community-hub-wiki-add-stat" onClick={() => updateGuide((target) => { target.stats = [...(target.stats ?? []), ["新重點", "內容"]]; })}><Icon name="plus" />新增首頁重點</button>
    </dl>
  </section>;
}

function ToolsEditor({ data, lang, onChange }: Pick<WikiInlineEditorProps, "data" | "lang" | "onChange">) {
  const labels = data.labels?.[lang] ?? {};
  const updateLabels = (key: string, value: string) => { const next = clone(data); next.labels = { ...(next.labels ?? {}), [lang]: { ...(next.labels?.[lang] ?? {}), [key]: value } }; onChange(next); };
  return <>
    <section className="community-hub-guide-section"><div>
      <h3><EditableText value={labels.communityToolsTitle || labels.toolsTitle || "Tools"} onCommit={(value) => updateLabels("communityToolsTitle", value)} /></h3>
      <p className="community-hub-guide-copy"><EditableText multiline value={labels.communityToolsSubtitle || labels.toolsSubtitle || ""} onCommit={(value) => updateLabels("communityToolsSubtitle", value)} /></p>
      <ul className="community-hub-guide-tool-list community-hub-wiki-collection-editor">
        {(data.tools ?? []).map((tool, index) => <li key={index}>
          <div><strong><EditableText value={localized(tool.name, lang)} onCommit={(value) => { const next = clone(data); const target = next.tools?.[index] as unknown as Record<string, unknown>; if (target) setLocalized(target, "name", lang, value); onChange(next); }} /></strong><p><EditableText value={(tool.authors ?? []).join(" · ")} onCommit={(value) => { const next = clone(data); if (next.tools?.[index]) next.tools[index].authors = value.split(/[·,，、]/).map((row) => row.trim()).filter(Boolean); onChange(next); }} /></p></div>
          <div className="community-hub-wiki-link-fields"><input value={tool.link ?? ""} aria-label="工具網址" placeholder="https://..." onChange={(event) => { const next = clone(data); if (next.tools?.[index]) next.tools[index].link = event.target.value; onChange(next); }} /><EditableText value={localized(tool.linkLabel, lang)} onCommit={(value) => { const next = clone(data); const target = next.tools?.[index] as unknown as Record<string, unknown>; if (target) setLocalized(target, "linkLabel", lang, value); onChange(next); }} /><EditorButton icon="trash-2" label="移除工具" tone="danger" onClick={() => { const next = clone(data); next.tools = next.tools?.filter((_, rowIndex) => rowIndex !== index); onChange(next); }} /></div>
        </li>)}
        <li><button type="button" className="community-hub-wiki-add-row" onClick={() => { const next = clone(data); next.tools = [...(next.tools ?? []), { name: { [lang]: "新工具" }, authors: [], link: "", linkLabel: { [lang]: "開啟" } }]; onChange(next); }}><Icon name="plus" />新增工具</button></li>
      </ul>
    </div></section>
    <section className="community-hub-guide-section"><div>
      <h3><EditableText value={labels.commandsTitle || "Commands"} onCommit={(value) => updateLabels("commandsTitle", value)} /></h3>
      <p className="community-hub-guide-copy"><EditableText multiline value={labels.commandsSubtitle || ""} onCommit={(value) => updateLabels("commandsSubtitle", value)} /></p>
      <ul className="community-hub-guide-command-list community-hub-wiki-collection-editor">
        {(data.commands ?? []).map((command, index) => <li key={index}><Icon name={command.icon || "terminal"} /><div><strong><EditableText value={localized(command.name, lang)} onCommit={(value) => { const next = clone(data); const target = next.commands?.[index] as unknown as Record<string, unknown>; if (target) setLocalized(target, "name", lang, value); onChange(next); }} /></strong><p><EditableText multiline value={localized(command.desc, lang)} onCommit={(value) => { const next = clone(data); const target = next.commands?.[index] as unknown as Record<string, unknown>; if (target) setLocalized(target, "desc", lang, value); onChange(next); }} /></p><div className="community-hub-wiki-link-fields"><input value={command.command ?? ""} aria-label="指令" placeholder="/command" onChange={(event) => { const next = clone(data); if (next.commands?.[index]) next.commands[index].command = event.target.value; onChange(next); }} /><input value={command.icon ?? ""} aria-label="圖示" placeholder="terminal" onChange={(event) => { const next = clone(data); if (next.commands?.[index]) next.commands[index].icon = event.target.value; onChange(next); }} /><EditorButton icon="trash-2" label="移除指令" tone="danger" onClick={() => { const next = clone(data); next.commands = next.commands?.filter((_, rowIndex) => rowIndex !== index); onChange(next); }} /></div></div></li>)}
        <li><button type="button" className="community-hub-wiki-add-row" onClick={() => { const next = clone(data); next.commands = [...(next.commands ?? []), { name: { [lang]: "新指令" }, desc: { [lang]: "指令說明" }, icon: "terminal", command: "" }]; onChange(next); }}><Icon name="plus" />新增指令</button></li>
      </ul>
    </div></section>
    <section className="community-hub-guide-section"><div>
      <h3>指令範例圖</h3>
      <div className="community-hub-wiki-showcase-editor">{(data.commandShowcase?.images ?? []).map((image, index) => <div key={index}>{image.src ? <img src={assets.guideAsset(image.src) || image.src} alt="" /> : null}<input value={image.src ?? ""} placeholder="圖片網址" onChange={(event) => { const next = clone(data); if (next.commandShowcase?.images?.[index]) next.commandShowcase.images[index].src = event.target.value; onChange(next); }} /><EditableText value={localized(image.caption, lang)} onCommit={(value) => { const next = clone(data); const target = next.commandShowcase?.images?.[index] as unknown as Record<string, unknown>; if (target) setLocalized(target, "caption", lang, value); onChange(next); }} /><EditorButton icon="trash-2" label="移除範例圖" tone="danger" onClick={() => { const next = clone(data); if (next.commandShowcase) next.commandShowcase.images = next.commandShowcase.images?.filter((_, rowIndex) => rowIndex !== index); onChange(next); }} /></div>)}</div>
      <button type="button" className="community-hub-wiki-add-row" onClick={() => { const next = clone(data); next.commandShowcase = { ...(next.commandShowcase ?? {}), images: [...(next.commandShowcase?.images ?? []), { src: "", caption: { [lang]: "新範例" } }] }; onChange(next); }}><Icon name="plus" />新增範例圖</button>
    </div></section>
  </>;
}

function FaqEditor({ data, lang, onChange }: Pick<WikiInlineEditorProps, "data" | "lang" | "onChange">) {
  const rows = data.faq?.[lang] ?? [];
  return <section className="community-hub-guide-section"><div><h3>{data.labels?.[lang]?.faqTitle || "FAQ"}</h3><PairRows rows={rows} onChange={(nextRows) => { const next = clone(data); next.faq = { ...(next.faq ?? {}), [lang]: nextRows }; onChange(next); }} /></div></section>;
}

function SbtCatalogEditor({ data, lang, onChange }: Pick<WikiInlineEditorProps, "data" | "lang" | "onChange">) {
  const rows = data.sbtItems ?? [];
  const update = (index: number, recipe: (target: LegacySbtItem) => void) => { const next = clone(data); const target = next.sbtItems?.[index]; if (!target) return; recipe(target); onChange(next); };
  return <section className="community-hub-guide-sbt-catalog"><header><p className="community-hub-section-index">SBT</p><h3>常駐 SBT 任務</h3></header><div className="community-hub-sbt-catalog-list community-hub-wiki-sbt-editor">
    {rows.map((row, index) => <article className="community-hub-sbt-item" key={row.key || index}><div className="community-hub-sbt-main"><p><EditableText value={localized(row.badge, lang)} onCommit={(value) => update(index, (target) => setLocalized(target as unknown as Record<string, unknown>, "badge", lang, value))} /></p><h3><EditableText value={localized(row.name, lang)} onCommit={(value) => update(index, (target) => setLocalized(target as unknown as Record<string, unknown>, "name", lang, value))} /></h3></div><div className="community-hub-sbt-acquisition"><span>取得方式</span><EditableText multiline value={localized(row.requirement, lang)} onCommit={(value) => update(index, (target) => setLocalized(target as unknown as Record<string, unknown>, "requirement", lang, value))} /></div><div className="community-hub-wiki-sbt-controls"><select value={row.status || "available"} onChange={(event) => update(index, (target) => { target.status = event.target.value; })}><option value="available">available</option><option value="closed">closed</option><option value="invite">invite</option><option value="hidden">hidden</option></select><input type="number" min="0" max="5" value={row.difficulty ?? 0} onChange={(event) => update(index, (target) => { target.difficulty = Number(event.target.value || 0); })} /><input value={(row.icons ?? []).join(", ")} placeholder="icon-1.png, icon-2.png" onChange={(event) => update(index, (target) => { target.icons = event.target.value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean); })} /><EditorButton icon="trash-2" label="移除 SBT" tone="danger" onClick={() => { const next = clone(data); next.sbtItems = next.sbtItems?.filter((_, rowIndex) => rowIndex !== index); onChange(next); }} /></div></article>)}
    <button type="button" className="community-hub-wiki-add-row" onClick={() => { const next = clone(data); next.sbtItems = [...(next.sbtItems ?? []), { key: `sbt-${Date.now()}`, name: { [lang]: "新 SBT" }, requirement: { [lang]: "取得方式" }, badge: { [lang]: "Available" }, status: "available", difficulty: 1, icons: [] }]; onChange(next); }}><Icon name="plus" />新增 SBT</button>
  </div></section>;
}

export function WikiInlineEditor({ data, lang, message, onCancel, onChange, onSave, saving, topicId }: WikiInlineEditorProps) {
  const topicRows = (data.topics?.[lang] ?? []).map((topic) => ({ id: topic.id, title: topic.title || topic.id }));
  const guide = data.guides?.[lang];
  const sections = guide?.sections ?? [];
  const explicitTopics = new Set(sections.map((section) => section.topic).filter(Boolean));
  const sectionIndexes = sections.map((section, index) => ({ section, index })).filter(({ section, index }) => {
    const legacyTopic = [0, 1].includes(index) ? "start" : [2, 3].includes(index) ? "packs" : index === 4 ? "market" : index === 5 ? "sbt" : "tcg";
    return (explicitTopics.size > 1 && section.topic ? section.topic : legacyTopic) === topicId;
  }).map(({ index }) => index);
  const addSection = () => {
    const next = clone(data);
    const rows = next.guides?.[lang]?.sections;
    if (!rows) return;
    rows.push({ type: "intro", topic: topicId, title: "新段落", text: "在這裡輸入內容。", bullets: ["新增重點"], layout: "image-left", image: 0 });
    onChange(next);
  };
  let content = null;
  if (topicId === "overview") content = <OverviewEditor data={data} lang={lang} onChange={onChange} />;
  else if (topicId === "tools") content = <ToolsEditor data={data} lang={lang} onChange={onChange} />;
  else if (topicId === "faq") content = <FaqEditor data={data} lang={lang} onChange={onChange} />;
  else content = <Fragment>{sectionIndexes.map((index) => <SectionEditor key={index} data={data} index={index} lang={lang} onChange={onChange} topics={topicRows} />)}{topicId === "sbt" ? <SbtCatalogEditor data={data} lang={lang} onChange={onChange} /> : null}<button type="button" className="community-hub-wiki-add-section" onClick={addSection}><Icon name="plus" />新增段落</button></Fragment>;
  return <div className="community-hub-wiki-edit-mode">
    <div className="community-hub-wiki-toolbar" role="toolbar" aria-label="Wiki 編輯工具">
      <div><Icon name="pencil-line" /><span>Creator 編輯模式</span><small>目前語言：{lang}，儲存後自動翻譯其他語言</small></div>
      <div><button type="button" onClick={onCancel} disabled={saving}><Icon name="x" />取消</button><button type="button" className="is-primary" onClick={onSave} disabled={saving}><Icon name={saving ? "loader-circle" : "save"} />{saving ? "儲存中" : "儲存並自動翻譯"}</button></div>
    </div>
    {message ? <p className="community-hub-wiki-message" role="status">{message}</p> : null}
    {content}
  </div>;
}
