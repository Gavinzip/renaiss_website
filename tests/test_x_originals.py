import copy
import unittest
from unittest.mock import patch
from x_originals import normalize_original, plain_text, attach_original, refresh_existing_originals
from x_intel.feedback_feed import _story_card_from_payload, _serialize_feed_cards
from x_intel import sources
from website_i18n_runtime import _apply_feed_translation, _collect_feed_i18n_entries

SID='2125207016931299647'
ACCOUNT='renaissCLTB'
URL=f'https://x.com/{ACCOUNT}/status/{SID}'

def post():
 return {'type':'status','id':SID,'url':URL,'author':{'screen_name':ACCOUNT,'id':'1505163583852019712','name':'Renaiss Protocol'},
         'is_note_tweet':True,'created_timestamp':1795523811,'text':'Original headline\n\n'+('Full paragraph. '*250)+'FINAL ORIGINAL TAIL',
         'media':{'all':[{'type':'photo','url':'https://pbs.twimg.com/media/original.jpg'},
                         {'type':'video','url':'https://video.twimg.com/original.mp4','thumbnail_url':'https://pbs.twimg.com/media/poster.jpg'}]}}

def card():
 return _story_card_from_payload({'id':SID,'account':ACCOUNT,'url':URL,'title':'AI title','summary':'AI summary',
    'raw_text':'Short preview','published_at':'2026-11-24T12:36:51Z','ai_status':'ok','card_type':'announcement'})

class OriginalsTests(unittest.TestCase):
 def setUp(self):
  import x_originals as x
  x._persisted_sources.clear();x._rate_limited=False
 def test_long_note_is_not_truncated_and_survives_card_persistence_and_hydration(self):
  p=post();o=normalize_original(p,ACCOUNT,SID);c=card();attach_original(c,o)
  self.assertEqual(plain_text(o),p['text']);self.assertGreater(len(c.raw_text),2500)
  saved=_serialize_feed_cards([c],{SID:card().to_dict()})[0]
  self.assertEqual(_story_card_from_payload(saved).original_content,o)
  self.assertEqual([b['text'] for b in saved['article_blocks'] if b['type']=='paragraph'][-1],p['text'].split('\n\n')[-1])
  self.assertEqual(o['blocks'][-1]['kind'],'video')
 def test_identity_and_incomplete_article_are_rejected(self):
  for changes in [{'id':'wrong'},{'author':{'screen_name':'renaissxyz'}},{'text':''},
                  {'article':{'title':'Preview only','preview_text':'Not a body'}}]:
   p=post();p.update(changes)
   with self.assertRaises((ValueError,KeyError)):normalize_original(p,ACCOUNT,SID)
 def test_source_is_never_translated_or_added_to_translation_queue(self):
  original=normalize_original(post(),ACCOUNT,SID);feed={'cards':[{'id':SID,'title':'Display title','original_content':original}]}
  result=_apply_feed_translation(feed,{f'cards[{SID}].original_content.title':'AI replacement',f'cards[{SID}].title':'Translated'})
  self.assertEqual(result['cards'][0]['original_content'],original)
  self.assertFalse(any('original_content' in key for key,_ in _collect_feed_i18n_entries(feed)))
 def test_draft_utf16_emoji_and_embedded_source_reference_are_preserved(self):
  p=post();p['article']={'title':'Article','content':{'blocks':[
   {'type':'unstyled','text':'😀 Source tail','entityRanges':[{'key':1,'offset':0,'length':2}],'inlineStyleRanges':[]},
   {'type':'atomic','text':'','data':{},'entityRanges':[]},
   {'type':'atomic','entityRanges':[{'key':2}]}],
   'entityMap':[{'key':'1','value':{'type':'TWEMOJI','data':{}}},{'key':'2','value':{'type':'TWEET','data':{'tweetId':SID}}}]}}
  result=normalize_original(p,ACCOUNT,SID)
  self.assertIn('😀 Source tail',plain_text(result));self.assertIn('https://x.com/i/status/'+SID,plain_text(result))
 def test_failed_refresh_preserves_last_full_original_and_marks_the_error(self):
  c=card();o=normalize_original(post(),ACCOUNT,SID);o['retrievedAt']='2026-11-24T00:00:00Z';attach_original(c,o)
  with patch('x_originals.fetch_original',side_effect=ValueError('Original unavailable')):
   status=refresh_existing_originals([c])
  self.assertEqual(c.original_content,o);self.assertIn(SID,status['incomplete_or_unavailable']);self.assertTrue(c.original_fetch_error)
 def test_normal_collection_entry_uses_the_full_source_without_other_provider_calls(self):
  o=normalize_original(post(),ACCOUNT,SID)
  with patch('x_originals.fetch_original',return_value=(o,post())),patch.object(sources,'fetch_status_metadata') as legacy:
   markdown,provider,meta=sources.fetch_status_markdown(ACCOUNT,SID)
   parsed=sources.parse_status_page(markdown,ACCOUNT,SID,URL,provider,meta)
  legacy.assert_not_called();self.assertEqual(provider,'fxembed');self.assertEqual(parsed.original_content,o);self.assertTrue(parsed.raw_text.endswith('FINAL ORIGINAL TAIL'))

class IncrementalTests(unittest.TestCase):
 def setUp(self):
  import x_originals as x
  x._persisted_sources.clear();x._rate_limited=False
 def test_persisted_full_originals_are_reused_without_source_requests(self):
  c=card();o=normalize_original(post(),ACCOUNT,SID);attach_original(c,o)
  c=_story_card_from_payload(c.to_dict())
  with patch('x_originals.fetch_original') as fetch:
   status=refresh_existing_originals([c])
   _,_,meta=sources.fetch_status_markdown(ACCOUNT,SID)
  fetch.assert_not_called();self.assertEqual(meta['original_content'],o);self.assertEqual(status['reused'],1)
 def test_missing_cltb_is_prioritized_and_progress_survives_next_batch(self):
  a=card();b=card();b.id='2125207016931299648';b.account='other';b.url=f'https://x.com/other/status/{b.id}'
  o=normalize_original(post(),ACCOUNT,SID)
  with patch('x_originals.fetch_original',return_value=(o,post())) as fetch:
   first=refresh_existing_originals([b,a],max_requests=1)
  fetch.assert_called_once_with(ACCOUNT,SID);self.assertEqual(first['deferred'],[b.id])
  with patch('x_originals.fetch_original',side_effect=ValueError('unavailable')) as fetch:
   refresh_existing_originals([b,_story_card_from_payload(a.to_dict())],max_requests=1)
  fetch.assert_called_once_with('other',b.id)
 def test_429_opens_circuit_and_prevents_next_network_request(self):
  import x_originals as x
  import requests
  x._request_status.cache_clear()
  response=unittest.mock.Mock(status_code=429)
  context=unittest.mock.MagicMock();context.__enter__.return_value=response
  response.raise_for_status.side_effect=requests.HTTPError(response=response)
  with patch('x_originals.requests.get',return_value=context) as get,patch('x_originals.time.sleep'):
   self.assertEqual(x._request_status(SID)[1],'HTTP_429')
   self.assertEqual(x._request_status('2125207016931299648')[1],'HTTP_429_cooldown')
  self.assertEqual(get.call_count,1)
 def tearDown(self):
  import x_originals as x
  x._persisted_sources.clear();x._rate_limited=False;x._request_status.cache_clear()

if __name__=='__main__':unittest.main()
