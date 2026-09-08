import type { RecordResult, RecordResultKind, RecordResultStatus } from "@/types";

const RECORD_KINDS: readonly ["" | RecordResultKind, string][] = [
  ["", "不是紀錄／結果"],
  ["competition_result", "比賽結果"],
  ["draw_result", "抽獎結果"],
  ["reward_claim", "獎勵開放領取"],
  ["reward_distributed", "獎勵已發放"],
  ["milestone_record", "正式里程碑"],
];

const RECORD_STATUSES: readonly [RecordResultStatus, string][] = [
  ["confirmed", "已確認"],
  ["claim_open", "開放領取"],
  ["distributed", "已發放"],
  ["completed", "已完成"],
];

export function RecordResultEditor({ value, onChange }: { value: RecordResult | null; onChange: (value: RecordResult | null) => void }) {
  const selectKind = (kind: "" | RecordResultKind) => {
    onChange(kind ? {
      kind,
      status: value?.status ?? "confirmed",
      subject: value?.subject ?? "",
      evidence: value?.evidence ?? "",
    } : null);
  };

  return <fieldset><legend>紀錄／結果</legend><div className="community-hub-admin-form-grid is-wide">
    <label><span>類型</span><select value={value?.kind ?? ""} onChange={(event) => selectKind(event.target.value as "" | RecordResultKind)}>{RECORD_KINDS.map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
    {value ? <>
      <label><span>狀態</span><select value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as RecordResultStatus })}>{RECORD_STATUSES.map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
      <label><span>對象</span><input value={value.subject} onChange={(event) => onChange({ ...value, subject: event.target.value })} /></label>
      <label><span>原文證據</span><textarea rows={2} value={value.evidence} onChange={(event) => onChange({ ...value, evidence: event.target.value })} /></label>
    </> : null}
  </div></fieldset>;
}
