"""AI failures cannot become publishable substitute summaries or dedupe results."""
import json
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch

from x_intel import sources, feedback_feed
from x_intel.feedback_feed import _story_card_from_payload
from hub_worker import process_job


def card(number='1', account='renaissCLTB', role='official'):
    return _story_card_from_payload({'id': number, 'account': account, 'source_role': role,
        'url': f'https://x.com/{account}/status/{number}', 'published_at': '2026-11-23T12:00:00Z',
        'card_type': 'announcement', 'title': '官方合作公告', 'summary': '根據原文整理的公告。',
        'raw_text': 'Renaiss partners with @NeoSoulAI to explore AI agents for onchain collectibles.'})


class PublicationFailureTests(unittest.TestCase):
    def setUp(self):
        self.cards = [card()]

    def test_digest_transport_and_schema_failures_propagate(self):
        for output in ['not JSON', '{}', '{"headline":"test","conclusion":"text","takeaways":[]}',
                       '{"headline":"test","conclusion":"text","takeaways":["same","same"]}']:
            with self.subTest(output=output), patch.object(sources, 'text_ai_chat', return_value=output):
                with self.assertRaisesRegex(RuntimeError, 'AI_DIGEST_INVALID_OUTPUT'):
                    sources.aggregate_digest(self.cards, {}, [], 'test-key')
        with patch.object(sources, 'text_ai_chat', side_effect=RuntimeError('OPENAI_HTTP_429')):
            with self.assertRaisesRegex(RuntimeError, 'OPENAI_HTTP_429'):
                sources.aggregate_digest(self.cards, {}, [], 'test-key')
        with self.assertRaisesRegex(RuntimeError, 'missing_openai_api_key'):
            sources.aggregate_digest(self.cards, {}, [])

    def test_overview_transport_and_schema_failures_propagate(self):
        for output in ['not JSON', '{}', '{"title":"test","summary":"text","bullets":[]}',
                       '{"title":"test","summary":"text","bullets":["same","same"]}']:
            with self.subTest(output=output), patch.object(feedback_feed, 'text_ai_chat', return_value=output):
                with self.assertRaisesRegex(RuntimeError, 'AI_OFFICIAL_OVERVIEW_INVALID_OUTPUT'):
                    feedback_feed.build_official_overview(self.cards, 'test-key')
        with patch.object(feedback_feed, 'text_ai_chat', side_effect=RuntimeError('OPENAI_HTTP_503')):
            with self.assertRaisesRegex(RuntimeError, 'OPENAI_HTTP_503'):
                feedback_feed.build_official_overview(self.cards, 'test-key')
        with self.assertRaisesRegex(RuntimeError, 'missing_openai_api_key'):
            feedback_feed.build_official_overview(self.cards)

    def test_short_valid_summaries_are_not_replaced_by_templates(self):
        with patch.object(sources, 'text_ai_chat', return_value=json.dumps({'headline':'合作公告','conclusion':'探索 AI 代理。','takeaways':['雙方合作探索。']})):
            self.assertEqual(sources.aggregate_digest(self.cards, {}, [], 'test-key')['conclusion'], '探索 AI 代理。')
        with patch.object(feedback_feed, 'text_ai_chat', return_value=json.dumps({'title':'合作公告','summary':'探索 AI 代理。','bullets':['雙方合作探索。']})):
            self.assertEqual(feedback_feed.build_official_overview(self.cards, 'test-key')['summary'], '探索 AI 代理。')

    def test_empty_input_is_an_explicit_empty_state_without_model_calls(self):
        with patch.object(sources, 'text_ai_chat') as digest, patch.object(feedback_feed, 'text_ai_chat') as overview:
            self.assertEqual(sources.aggregate_digest([], {}, [])['takeaways'], [])
            self.assertIn('尚未', feedback_feed.build_official_overview([])['summary'])
            self.assertEqual(feedback_feed.apply_text_ai_global_dedupe([], ''), ([], 0))
            digest.assert_not_called(); overview.assert_not_called()

    def test_dedupe_failure_cannot_look_like_successful_zero_duplicates(self):
        cases=[('not JSON','AI_DEDUPE_INVALID_OUTPUT'), ('{}','AI_DEDUPE_INVALID_OUTPUT'),
               ('{"drop_ids":[null]}','AI_DEDUPE_INVALID_OUTPUT'),
               ('{"drop_ids":["missing"]}','AI_DEDUPE_UNKNOWN_ID'),
               ('{"drop_ids":["1"]}','AI_DEDUPE_PROTECTED_ID')]
        for output, error in cases:
            with self.subTest(output=output), patch.object(feedback_feed, 'text_ai_chat', return_value=output):
                with self.assertRaisesRegex(RuntimeError, error):
                    feedback_feed.apply_text_ai_global_dedupe(self.cards, 'test-key')
        with patch.object(feedback_feed, 'text_ai_chat', side_effect=RuntimeError('OPENAI_HTTP_429')):
            with self.assertRaisesRegex(RuntimeError, 'OPENAI_HTTP_429'):
                feedback_feed.apply_text_ai_global_dedupe(self.cards, 'test-key')

    def test_valid_dedupe_results_respect_publication_guard(self):
        candidates=[card(str(i), 'community', 'other') for i in range(8)]
        with patch.object(feedback_feed, 'text_ai_chat', return_value='{"drop_ids":[]}'):
            self.assertEqual(feedback_feed.apply_text_ai_global_dedupe(candidates,'test-key'), (candidates,0))
        with patch.object(feedback_feed, 'text_ai_chat', return_value='{"drop_ids":["7"]}'):
            result, count=feedback_feed.apply_text_ai_global_dedupe(candidates,'test-key')
            self.assertEqual((len(result),count), (7,1))
        with patch.object(feedback_feed, 'text_ai_chat', return_value='{"drop_ids":["3","4","5","6","7"]}'):
            with self.assertRaisesRegex(RuntimeError, 'AI_DEDUPE_EXCESSIVE_REMOVAL'):
                feedback_feed.apply_text_ai_global_dedupe(candidates,'test-key')

    def test_failed_processing_never_commits_a_new_publication(self):
        # No database or disk writes: exercise the real worker's commit boundary.
        root=MagicMock(spec=Path)
        root.__truediv__.return_value.read_text.return_value='AI_DIGEST_INVALID_OUTPUT'
        snapshots=Mock(); snapshots.materialize.return_value={}
        queue=Mock(spec=['heartbeat', 'assert_owned'])
        with patch('subprocess.run', return_value=Mock(returncode=1)), patch('hub_database_audit.phase', side_effect=lambda *a,**k:nullcontext()):
            with self.assertRaisesRegex(RuntimeError, 'AI_DIGEST_INVALID_OUTPUT'):
                process_job({'kind':'sync','control_plane':'vercel'},queue,snapshots,root)
        snapshots.complete_job.assert_not_called()
        queue.assert_owned.assert_not_called()


if __name__ == '__main__':
    unittest.main()
