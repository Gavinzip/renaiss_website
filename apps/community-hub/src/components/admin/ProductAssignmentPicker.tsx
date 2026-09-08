import { PRODUCT_OPTIONS } from "@/lib/productPortfolio";

export function ProductAssignmentPicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const selected = new Set(value);
  const toggle = (productId: string) => {
    const next = new Set(selected);
    if (next.has(productId)) next.delete(productId); else next.add(productId);
    onChange([...next]);
  };

  return <fieldset><legend>產品歸屬（可留空、不顯示於卡片）</legend><div className="community-hub-admin-topics">
    {PRODUCT_OPTIONS.map((product) => <label key={product.id} className={selected.has(product.id) ? "is-selected" : ""}><input type="checkbox" checked={selected.has(product.id)} onChange={() => toggle(product.id)} /><span>{product.name}</span></label>)}
  </div></fieldset>;
}
