import { Icon } from "@/components/Icon";
import { text } from "@/lib/copy";
import type { Language } from "@/types";

interface PaginationProps {
  lang: Language;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ lang, page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  return <nav className="community-hub-pagination" aria-label={text(lang, "pagination.label")}>
    <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
      <Icon name="arrow-left" />
      <span>{text(lang, "pagination.previous")}</span>
    </button>
    <span>{text(lang, "pagination.page")} {page} / {pageCount}</span>
    <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
      <span>{text(lang, "pagination.next")}</span>
      <Icon name="arrow-right" />
    </button>
  </nav>;
}
