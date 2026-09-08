import { Icon } from "@/components/Icon";
import type { SbtEntry, SbtEntryStatus } from "@/types";

const SBT_STATUSES: readonly [SbtEntryStatus, string][] = [
  ["unknown", "待確認"],
  ["upcoming", "即將開放"],
  ["available", "可取得"],
  ["ended", "已結束"],
  ["distributed", "已發放"],
];

const EMPTY_ENTRY: SbtEntry = {
  name: "",
  acquisition: "",
  status: "unknown",
  start_date: "",
  end_date: "",
  evidence: "",
};

export function SbtEntriesEditor({ entries, onChange }: { entries: SbtEntry[]; onChange: (entries: SbtEntry[]) => void }) {
  const updateEntry = <K extends keyof SbtEntry>(index: number, field: K, value: SbtEntry[K]) => {
    onChange(entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  };

  return <fieldset><legend>SBT 結構</legend>
    {entries.map((entry, index) => <div className="community-hub-admin-form-grid is-wide" key={`sbt-${index}`}>
      <label><span>SBT 名稱</span><input value={entry.name} onChange={(event) => updateEntry(index, "name", event.target.value)} /></label>
      <label><span>狀態</span><select value={entry.status} onChange={(event) => updateEntry(index, "status", event.target.value as SbtEntryStatus)}>{SBT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>開始日</span><input type="date" value={entry.start_date} onChange={(event) => updateEntry(index, "start_date", event.target.value)} /></label>
      <label><span>結束日</span><input type="date" value={entry.end_date} onChange={(event) => updateEntry(index, "end_date", event.target.value)} /></label>
      <label><span>取得方式</span><textarea rows={2} value={entry.acquisition} onChange={(event) => updateEntry(index, "acquisition", event.target.value)} /></label>
      <label><span>原文證據</span><textarea rows={2} value={entry.evidence} onChange={(event) => updateEntry(index, "evidence", event.target.value)} /></label>
      <button type="button" onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}><Icon name="trash-2" />移除這筆 SBT</button>
    </div>)}
    <button type="button" onClick={() => onChange([...entries, { ...EMPTY_ENTRY }])}><Icon name="plus" />新增 SBT</button>
  </fieldset>;
}
