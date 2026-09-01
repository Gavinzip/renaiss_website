import { Icon } from "@/components/Icon";
import { PROJECTS, projectLabel, type ProjectId } from "@/lib/projects";
import type { Language } from "@/types";

type ProjectFilterValue = "all" | ProjectId;

interface ProjectFilterNavProps {
  active: ProjectFilterValue;
  allCount: number;
  allLabel: string;
  ariaLabel: string;
  counts: ReadonlyMap<ProjectId, number>;
  lang: Language;
  onChange: (value: ProjectFilterValue) => void;
}

export function ProjectFilterNav({ active, allCount, allLabel, ariaLabel, counts, lang, onChange }: ProjectFilterNavProps) {
  return <div className="community-hub-filter-row community-hub-project-filter community-hub-project-filter-motion" aria-label={ariaLabel}>
    <button
      type="button"
      className="community-hub-project-filter-button"
      aria-pressed={active === "all"}
      onClick={() => onChange("all")}
    >
      <span className="community-hub-project-filter-label">{allLabel}</span>
      <span className="community-hub-project-filter-count">{allCount}</span>
    </button>
    {PROJECTS.map((project) => <button
      type="button"
      key={project.id}
      className="community-hub-project-filter-button"
      aria-pressed={active === project.id}
      onClick={() => onChange(project.id)}
    >
      <Icon name={project.icon} />
      <span className="community-hub-project-filter-label">{projectLabel(project.id, lang)}</span>
      <span className="community-hub-project-filter-count">{counts.get(project.id) ?? 0}</span>
    </button>)}
  </div>;
}
