"""Run the existing classifier and translator in a hydrated processing copy."""
from __future__ import annotations

import json
from pathlib import Path


def run_pipeline(job: dict, root: Path, progress) -> dict:
    from hub_job_lanes import is_agent_job
    if is_agent_job(job):
        from hub_agent_pipeline import answer_job
        return answer_job(job, progress)
    from x_intel import feedback_feed as legacy
    from x_intel_core import build_card_from_url, resolve_minimax_key
    from website_i18n_runtime import configure_i18n_runtime, rebuild_i18n_bundle_sync, feed_i18n_source_content_hash
    from website_feed_source import canonical_feed_source

    feed_path = root / "x_intel_feed.json"
    configure_i18n_runtime(root, feed_path)
    before = json.loads(feed_path.read_bytes())
    if job['kind'] in {'sync','reanalyze','analyze_url'} and not resolve_minimax_key():
        raise RuntimeError('AI key is not configured; no substitute analysis will be published')
    response = None
    warnings = []
    if job['kind'] == 'backup':
        response = {'ok':True,'backup':{}}  # Created atomically by complete_job.
        feed=before;card={}
    elif job['kind'] == 'restore':
        from hub_restore_points import restore_to_workspace
        response = {'ok':True,'restore':restore_to_workspace(root,str(job['input'].get('backup_id') or ''))}
        feed=json.loads(feed_path.read_bytes());card={}
    elif job['kind'] == 'sync':
        progress('依追蹤來源自動抓文、分類與整理')
        def report(event, row=None, **fields):
            values = row if isinstance(row,dict) else fields
            progress(str(event)+': '+str(values.get('latest_source') or values.get('current_title') or '')[:120])
        feed = legacy.sync_accounts(accounts=job['input'].get('accounts'),window_days=max(1,min(int(job['input'].get('days') or 30),365)),max_posts_per_account=20,progress_callback=report,strict_sources=True)
        errors = (feed.get('source_scan') or {}).get('errors') or {}
        warnings = [str(k)+': '+str(v) for k,v in errors.items()]
        discord = feed.get('discord_monitor') or {}
        warnings.extend(discord.get('errors') or [])
        knowledge = feed.get('knowledge_memory_stats') or {}
        if knowledge.get('embedding_status') in {'failed','missing_api_key'}:
            warnings.append('知識搜尋向量未更新：'+str(knowledge.get('embedding_error') or knowledge['embedding_status']))
        card = {}
        response = {'ok':True,'sync':{'status':'done','warnings':warnings},'new_source_stats':feed.get('new_source_stats'),'source_scan':feed.get('source_scan')}
    elif job['kind'] == 'action':
        progress('套用管理操作至獨立測試資料')
        from hub_worker_actions import run_action
        response = run_action(job,root)
        feed = json.loads(feed_path.read_bytes())
        card = {}
    elif job['kind'] == 'metrics':
        progress('更新社群統計')
        from x_intel.community_metrics import run_community_metrics_backfill
        metrics = run_community_metrics_backfill(data_root=root,feed_path=feed_path,i18n_feed_path=root/'x_intel_feed_i18n.json')
        if metrics.get('status') == 'failed':
            raise RuntimeError('Community metrics failed: '+str(metrics.get('last_error') or 'unknown error'))
        response = {'ok':True,'metrics':metrics}
        feed = json.loads(feed_path.read_bytes())
        card = {}
    elif job["kind"] == "reanalyze":
        progress("使用原 AI 分類器重新分析貼文")
        update = legacy.refresh_card_content(job["input"]["id"])
        if update.get("mode") != "ai":
            detail = update.get('classification_error') or (update.get('card') or {}).get('classification_error') or update.get('mode')
            raise RuntimeError("AI analysis requires review: " + str(detail))
        feed = json.loads(feed_path.read_bytes())
        card = next(c for c in feed["cards"] if str(c.get("id")) == job["input"]["id"])
    elif job["kind"] == "analyze_url":
        progress("擷取原文並使用原 AI 分類器分析")
        card_obj = build_card_from_url(job["input"]["url"], api_key=resolve_minimax_key())
        if str(card_obj.ai_status) != "ok":
            raise RuntimeError("AI analysis did not pass validation: " + str(card_obj.classification_error))
        card_obj.manual_pick = True
        card = card_obj.to_dict()
        existing = next((c for c in before["cards"] if str(c.get("id")) == str(card["id"])), None)
        if existing:
            raise ValueError("This URL already exists; use its reanalysis action to preserve editorial overrides")
        feed = dict(before)
        feed["cards"] = [card, *before["cards"]]
        from datetime import datetime, timezone
        feed["generated_at"] = datetime.now(timezone.utc).isoformat()
        legacy._refresh_snapshot_counts(feed)
        legacy.set_manual_selection(card["id"], "include")
        manual_path = root / "x_intel_manual_entries.json"
        entries = json.loads(manual_path.read_bytes()) if manual_path.exists() else []
        legacy.write_json(manual_path, [*entries, card])
        legacy.write_json(feed_path, feed)
    else:
        feed = before
        card = {}

    source = canonical_feed_source(feed)
    source_hash = feed_i18n_source_content_hash(source)
    bundle_path = root/'x_intel_feed_i18n.json'
    bundle = json.loads(bundle_path.read_bytes()) if bundle_path.exists() else {}
    translate_now = job['kind'] in {'sync','reanalyze','analyze_url','translate'}
    needs_translation = job['kind']=='action' and source_hash != bundle.get('source_content_hash')
    if translate_now:
        progress('沿用翻譯快取並更新多語貼文')
        targets=job['input'].get('target_langs',['zh-Hant','zh-Hans','en','ko'])
        force=bool(job['input'].get('force'))
        if force:
            from website_i18n_runtime import _clear_translation_cache_for_langs, _drop_bundle_langs
            _clear_translation_cache_for_langs(targets); _drop_bundle_langs(targets)
        bundle=rebuild_i18n_bundle_sync(source,target_langs=targets,force=force)
        if bundle.get('source_content_hash')!=source_hash:
            raise RuntimeError('Translation source differs from the website source')
        incomplete={lang:(bundle.get('qa',{}).get(lang) or {}).get('pending_count',1) for lang in targets if (bundle.get('qa',{}).get(lang) or {}).get('pending_count',1)>0}
        if incomplete:raise RuntimeError('Translation has unfinished entries: '+json.dumps(incomplete))
    from hub_public_feed import prepare_public_feeds
    prepare_public_feeds(root)
    qa=bundle.get('qa') or {}
    return {
        "message": "操作已保存至測試資料庫。" if not warnings else "工作完成，但部分來源抓取失敗，請查看 warnings。",
        "warnings": warnings, "response": response, "needs_translation": needs_translation, "restored": job["kind"]=="restore",
        "tweet_id": card.get("id"), "tweet_url": card.get("url"),
        "ai_status": card.get("ai_status"), "ai_model": card.get("ai_model"),
        "cards": len(feed["cards"]), "translated_languages": sorted(bundle.get("langs", {})),
        "translation_qa": qa,
    }
