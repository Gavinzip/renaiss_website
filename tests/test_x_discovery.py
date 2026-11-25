import unittest
from unittest.mock import patch
from x_intel import bootstrap

class DiscoveryTests(unittest.TestCase):
 def test_relative_timeline_links_are_discovered_without_including_quoted_accounts(self):
  page='''<article data-href="/renaissCLTB/status/2125472123045150731"><a href="/renaissCLTB/status/2125472123045150731">56m</a><a href="/BinanceWallet/status/2125469604533428332">quote</a><a href="https://evil.example/renaissCLTB/status/2125472123045150732">foreign</a></article>'''
  self.assertEqual(bootstrap.extract_status_ids(page,'renaissCLTB'),['2125472123045150731'])
 def test_absolute_markdown_links_remain_supported_and_deduplicated(self):
  self.assertEqual(bootstrap.extract_status_ids('https://x.com/renaissCLTB/status/2125472123045150731 <a href="/renaissCLTB/status/2125472123045150731">time</a>','@renaissCLTB'),['2125472123045150731'])
 def test_profile_requests_dom_and_stops_after_valid_timeline(self):
  with patch.object(bootstrap,'fetch_text',return_value='<a href="/renaissCLTB/status/2125472123045150731">time</a>') as get:
   self.assertTrue(bootstrap.fetch_profile_page('renaissCLTB'))
  get.assert_called_once_with('https://r.jina.ai/http://x.com/renaissCLTB',response_format='html')
 def test_discovery_header_is_limited_to_jina_profile_requests(self):
  with patch.object(bootstrap,'_jina_api_key',return_value=''),patch.object(bootstrap,'_wait_for_jina_slot'),patch.object(bootstrap.requests,'get') as get:
   get.return_value.text='<html></html>'
   bootstrap.fetch_text('https://r.jina.ai/http://x.com/renaissCLTB',response_format='html')
   self.assertEqual(get.call_args.kwargs['headers']['X-Respond-With'],'html')
   bootstrap.fetch_text('https://example.com')
   self.assertNotIn('X-Respond-With',get.call_args.kwargs['headers'])
