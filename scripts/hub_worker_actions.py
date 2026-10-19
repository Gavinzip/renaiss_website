"""Original editorial operations on a worker-owned processing snapshot."""
from __future__ import annotations

from pathlib import Path
import json

ACTION_PATHS = {
    '/api/intel/editorial', '/api/intel/pick', '/api/intel/timeline',
    '/api/intel/event-wall', '/api/intel/sbt-fields', '/api/intel/feedback',
    '/api/intel/source-config', '/api/intel/public-feedback',
    '/api/intel/agent', '/api/intel/translate-texts',
}


def run_action(job: dict, root: Path) -> dict:
    from x_intel import feedback_feed as legacy
    from x_intel_core import update_x_source_accounts
    data = job['input']; path = data['path']; body = data['body']; actor = job['created_by']
    if path not in ACTION_PATHS:
        raise ValueError('Unsupported website action')
    card_id = str(body.get('id') or '').strip()
    if path == '/api/intel/editorial':
        update = legacy.update_card_editorial_fields(card_id, patch=body.get('patch') or {}, actor=actor,
            expected_revision=int(body['expected_revision']) if body.get('expected_revision') is not None else None)
        return {'ok': True, 'update': update}
    if path == '/api/intel/pick':
        action = str(body.get('action') or '').strip()
        selection = legacy.set_manual_selection(card_id, action)
        if action == 'exclude' and body.get('reason'):
            legacy.add_classification_feedback(card_id, 'exclude', reason=str(body['reason']))
        legacy.apply_manual_selection_to_feed_snapshot(card_id, action)
        return {'ok': True, 'selection': selection, 'mode': 'snapshot'}
    if path == '/api/intel/timeline':
        update = legacy.update_card_timeline_fields(card_id, timeline_date=str(body.get('timeline_date') or ''), timeline_end_date=str(body.get('timeline_end_date') or ''))
        return {'ok': True, 'update': update}
    if path == '/api/intel/event-wall':
        return {'ok': True, 'update': legacy.update_card_event_wall_field(card_id, bool(body.get('event_wall')))}
    if path == '/api/intel/sbt-fields':
        return {'ok': True, 'update': legacy.update_card_sbt_entries(card_id, body.get('sbt_entries'))}
    if path == '/api/intel/feedback':
        fields = {'card_type':str(body.get('card_type') or '').strip().lower(),
            'routing_topic':str(body.get('section') or body.get('routing_topic') or '').strip().lower(),
            'routing_topics':body.get('routing_topics') if isinstance(body.get('routing_topics'),list) else None,
            'product_ids':body.get('product_ids') if isinstance(body.get('product_ids'),list) else None}
        if fields['card_type'] or fields['routing_topic'] or fields['routing_topics'] is not None or fields['product_ids'] is not None:
            feedback = legacy.add_classification_feedback_fields(card_id, **fields, reason=str(body.get('reason') or ''))
            update = legacy.update_card_classification_fields(card_id, **fields)
        else:
            label = str(body.get('label') or '').strip().lower()
            feedback = legacy.add_classification_feedback(card_id, label, reason=str(body.get('reason') or ''))
            if label in legacy.ALLOWED_CARD_TYPES or label in legacy.ALLOWED_ROUTING_TOPICS:
                update = legacy.update_card_classification_fields(card_id,
                    card_type=label if label in legacy.ALLOWED_CARD_TYPES else '',
                    routing_topic=label if label in legacy.ALLOWED_ROUTING_TOPICS else '')
            else:
                update = {'id': card_id, 'skipped':True, 'reason':'no_card_field_patch'}
        return {'ok': True, 'feedback': feedback, 'update': update}
    if path == '/api/intel/source-config':
        source = update_x_source_accounts(action=str(body.get('action') or ''),account=str(body.get('account') or ''),accounts=body.get('accounts'),category=str(body.get('category') or ''),project_id=str(body.get('project_id') or ''))
        return {'ok': True, 'source': source}
    if path == '/api/intel/agent':
        raise ValueError('Knowledge questions must use the independent agent pipeline')
    if path == '/api/intel/translate-texts':
        from website_i18n_runtime import translate_texts
        texts = body.get('texts')
        if not isinstance(texts,list) or len(texts)>220:
            raise ValueError('texts must contain at most 220 entries')
        items, mode = translate_texts([str(t)[:320] for t in texts],lang=str(body.get('lang') or 'zh-Hant'),strict=True)
        if mode in {'fallback','passthrough','error'}:
            raise RuntimeError('Translation did not complete: '+mode)
        return {'ok': True, 'items': items, 'mode': mode, 'lang': body.get('lang')}
    # Reuse the original Wiki and feedback validators. This module import does
    # not start main(), schedulers, or the HTTP server.
    import ai_intel_server as server
    if path == '/api/intel/public-feedback':
        return {'ok': True, **server._store_public_feedback(body,user_agent=str(data.get('user_agent') or ''),referer=str(data.get('referer') or ''))}
    raise ValueError('Unsupported website action')
