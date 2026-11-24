import os
import unittest
from unittest.mock import patch, Mock

from text_ai import text_ai_chat, text_ai_model_name, resolve_text_ai_key, extract_response_text, TextAIError
from x_intel.official_updates import news_category_metadata
from x_intel.bootstrap import infer_official_update_metadata, OFFICIAL_X_ACCOUNT_ROLES
from x_intel.feedback_feed import _story_card_from_payload
from website_feed_source import canonical_feed_source


def completed(text='{"ok":true}'):
    return {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": text}]}]}


class OpenAITransportTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_only_openai_keys_are_accepted(self):
        with patch.dict(os.environ, {"MINIMAX_API_KEY": "legacy-only"}):
            self.assertEqual(resolve_text_ai_key(), '')
        with patch.dict(os.environ, {"OPENAI_API_KEY": "shared", "OPENAI_TEXT_API_KEY": "text", "INTEL_OPENAI_TEXT_API_KEY": "pipeline"}):
            self.assertEqual(resolve_text_ai_key(), 'pipeline')
        self.assertEqual(text_ai_model_name(), 'gpt-6-luna')

    @patch('text_ai.requests.post')
    def test_responses_request_preserves_json_arrays_and_omits_legacy_parameters(self, post):
        post.return_value = Mock(status_code=200, json=lambda: completed('["English", "한국어"]'))
        self.assertEqual(text_ai_chat('Return JSON.', 'test-key'), '["English", "한국어"]')
        args, call = post.call_args
        self.assertEqual(args[0], 'https://api.openai.com/v1/responses')
        self.assertEqual(call['json']['model'], 'gpt-6-luna')
        self.assertFalse(call['json']['store'])
        self.assertFalse(call['allow_redirects'])
        self.assertEqual(call['timeout'], (15, 120))
        self.assertFalse({'temperature', 'reasoning_split', 'max_tokens', 'messages'} & call['json'].keys())

    @patch('text_ai.requests.post')
    def test_agent_explicit_budget_survives_disabled_global_limit(self, post):
        post.return_value = Mock(status_code=200, json=lambda: completed('Answer'))
        with patch.dict(os.environ, {'OPENAI_TEXT_MAX_OUTPUT_TOKENS': '200'}):
            text_ai_chat('Question', 'test-key', max_output_tokens=4096, use_env_max_tokens=False, read_timeout_override=80)
        self.assertEqual(post.call_args.kwargs['json']['max_output_tokens'], 4096)
        self.assertEqual(post.call_args.kwargs['timeout'], (15, 80))

    @patch('text_ai.requests.post')
    def test_missing_key_never_calls_another_provider(self, post):
        with self.assertRaisesRegex(TextAIError, 'missing_openai_api_key'):
            text_ai_chat('Question', '')
        post.assert_not_called()

    @patch('text_ai.requests.post')
    def test_errors_do_not_return_partial_or_substitute_text(self, post):
        post.return_value = Mock(status_code=401, json=lambda: {'error': {'message': 'secret'}})
        with self.assertRaisesRegex(TextAIError, '^OPENAI_HTTP_401$'):
            text_ai_chat('Question', 'test-key')
        self.assertEqual(post.call_count, 1)
        with self.assertRaisesRegex(TextAIError, 'INCOMPLETE'):
            extract_response_text({'status': 'incomplete', 'incomplete_details': {'reason': 'max_output_tokens'}, 'output': completed()['output']})
        with self.assertRaisesRegex(TextAIError, 'REFUSAL'):
            extract_response_text({'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'refusal'}]}]})
        with self.assertRaisesRegex(TextAIError, 'EMPTY'):
            extract_response_text({'status': 'completed', 'output': [{'type': 'reasoning', 'summary': []}]})

    @patch('text_ai.requests.post')
    def test_invalid_config_fails_before_transport(self, post):
        for setting in [{'OPENAI_TEXT_MODEL': 'MiniMax-M3'}, {'OPENAI_TEXT_REASONING_EFFORT': 'invented'}, {'OPENAI_TEXT_MAX_OUTPUT_TOKENS': '-1'}, {'OPENAI_TEXT_READ_TIMEOUT_SECONDS': '0'}]:
            with patch.dict(os.environ, setting):
                with self.assertRaises(TextAIError):
                    text_ai_chat('Question', 'test-key')
        post.assert_not_called()


class OfficialNewsTests(unittest.TestCase):
    def test_partnership_metadata_reaches_both_public_serialization_paths(self):
        row = {'id': '2115391769953382875', 'account': 'renaissCLTB', 'source_role': 'official',
               'url': 'https://x.com/renaissCLTB/status/2115391769953382875',
               'raw_text': 'Renaiss partners with @NeoSoulAI', 'card_type': 'announcement',
               'published_at': '2026-10-28T12:00:00Z'}
        with patch('website_feed_source.read_x_source_config', return_value={}):
            public = canonical_feed_source({'cards': [row]})['cards'][0]
        for result in [_story_card_from_payload(row).to_dict(), public]:
            self.assertEqual(result['news_categories'], ['Community', 'Partnership'])
            self.assertEqual(result['official_update_kind'], 'partnership')
            self.assertEqual(result['partner_names'], ['@NeoSoulAI'])

    def test_cltb_partnership_is_not_limited_to_index(self):
        for text, partner in [('Renaiss partners with @NeoSoulAI 🤝', '@NeoSoulAI'), ('Renaiss Partners with @xstablerwa', '@xstablerwa'), ('Renaiss integrates with @rarible', '@rarible')]:
            self.assertEqual(infer_official_update_metadata('renaissCLTB', text), ('partnership', [partner]))
            result = news_category_metadata(text, 'announcement')
            self.assertEqual(result['news_categories'], ['Community', 'Partnership'])
            self.assertIn(result['news_category_evidence']['Partnership'], text)
        self.assertIn('Protocol', OFFICIAL_X_ACCOUNT_ROLES['renaisscltb'])
        self.assertNotIn('Web2', OFFICIAL_X_ACCOUNT_ROLES['renaisscltb'])

    def test_developer_facets_do_not_rewrite_card_type_or_tag_casual_meetups(self):
        result = news_category_metadata('Renaiss SDK and underlying protocol components.', 'announcement')
        self.assertEqual(result['news_categories'], ['Community', 'Builders'])
        for text in ['Come meet builders and partners over drinks.', 'Thank you to our partners and community.', 'Today we turn one. SDK. CLI. Index. Fair.']:
            result = news_category_metadata(text, 'event')
            self.assertEqual(result['news_categories'], ['Events'])


if __name__ == '__main__':
    unittest.main()
