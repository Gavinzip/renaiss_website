import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { limitedPackSbtCopy } from "@/lib/limitedPackSbtCopy";
import type { LimitedPackSbtSnapshot, PackSbtCampaign } from "@/lib/limitedPackSbt";
import { packDateTime, packSbtPair } from "../../../../website/assets/limited-pack-sbt.js";
import { taipeiWeek, weeklyPackCampaigns } from "@/lib/limitedPackWindow";
import type { AccountProjectMap } from "@/lib/projects";
import type { FeedCard, Language } from "@/types";
import "./LimitedPackSbt.css";

function Pack({ pack, lang }: { pack: PackSbtCampaign; lang: Language }) {
  const copy = limitedPackSbtCopy[lang];
  const tasks = packSbtPair(pack, lang);
  return <article className="community-hub-pack-sbt" data-status={pack.status}>
    <header><div><span className={`community-hub-pack-status is-${pack.status}`}>{copy[pack.status]}</span><h3>{pack.name}</h3></div><a href={pack.source_url} target="_blank" rel="noreferrer">{pack.source_url.startsWith("https://x.com/") ? copy.announcement : copy.source}<Icon name="arrow-up-right" /></a></header>
    <p className="community-hub-pack-period"><span>{pack.earning_end ? copy.period : copy.opensAt} · UTC+8</span><time dateTime={pack.earning_start ?? undefined}>{packDateTime(pack.earning_start, lang)}</time>{pack.earning_end ? <><span>–</span><time dateTime={pack.earning_end}>{packDateTime(pack.earning_end, lang)}</time></> : null}</p>
    <ul className="community-hub-pack-badges">{tasks.map((task) => <li key={task.key}>
      <div><small>{copy.nameLabel}{task.official ? "" : ` · ${copy.preview}`}</small><h4>{task.name}</h4></div>
      <dl><div><dt>{copy.acquisitionLabel}</dt><dd>{task.acquisition}</dd></div><div><dt>{copy.packLabel}</dt><dd>{task.pack_name}</dd></div></dl>
      {task.official ? <details><summary>{copy.officialRule}</summary><p lang="en">{task.official.name} · {task.official.requirement}</p></details> : null}
    </li>)}</ul>
    {tasks.some((task) => !task.official) ? <p className="community-hub-pack-preview-note">{copy.pendingBadges}</p> : null}
  </article>;
}

export function LimitedPackSbt({ snapshot, cards, accountProjects, lang }: { snapshot: LimitedPackSbtSnapshot; cards: FeedCard[]; accountProjects: AccountProjectMap; lang: Language }) {
  const [reference, setReference] = useState(() => new Date());
  const current = useMemo(() => weeklyPackCampaigns(snapshot, cards, accountProjects, reference), [snapshot, cards, accountProjects, reference]);
  useEffect(() => {
    const boundaries = [taipeiWeek(reference)[1], ...current.flatMap((pack) => [pack.earning_start, pack.earning_end].flatMap((value) => value && Date.parse(value) > reference.valueOf() ? [Date.parse(value)] : []))];
    const delay = Math.min(60_000, Math.min(...boundaries) - Date.now());
    const timer = setTimeout(() => setReference(new Date()), Math.max(0, delay) + 25);
    return () => clearTimeout(timer);
  }, [current, reference]);
  const copy = limitedPackSbtCopy[lang];
  if (snapshot.status !== "ready") return <div className="community-hub-pack-source-state" role="status">{copy[snapshot.status]}</div>;
  return <div className="community-hub-limited-packs">
    {current.length ? current.map((pack) => <Pack key={pack.id} pack={pack} lang={lang} />) : <p className="community-hub-pack-source-state">{copy.noOpen}</p>}
    <footer className="community-hub-pack-footnote">{current.length ? <p>{copy.note}</p> : null}{snapshot.checked_at ? <small>{copy.checked} <time dateTime={snapshot.checked_at}>{packDateTime(snapshot.checked_at, lang)} UTC+8</time></small> : null}</footer>
  </div>;
}
