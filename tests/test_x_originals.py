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
  c=card();o=normalize_original(post(),ACCOUNT,SID);attach_original(c,o)
  with patch('x_originals.fetch_original',side_effect=ValueError('Original unavailable')):
   status=refresh_existing_originals([c])
  self.assertEqual(c.original_content,o);self.assertIn(SID,status['incomplete_or_unavailable']);self.assertTrue(c.original_fetch_error)
 def test_normal_collection_entry_uses_the_full_source_without_other_provider_calls(self):
  o=normalize_original(post(),ACCOUNT,SID)
  with patch('x_originals.fetch_original',return_value=(o,post())),patch.object(sources,'fetch_status_metadata') as legacy:
   markdown,provider,meta=sources.fetch_status_markdown(ACCOUNT,SID)
   parsed=sources.parse_status_page(markdown,ACCOUNT,SID,URL,provider,meta)
  legacy.assert_not_called();self.assertEqual(provider,'fxembed');self.assertEqual(parsed.original_content,o);self.assertTrue(parsed.raw_text.endswith('FINAL ORIGINAL TAIL'))

if __name__=='__main__':unittest.main()
