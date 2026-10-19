"""Answer from the captured publication without running editorial publication."""


def answer_job(job, progress):
    from x_intel.knowledge_agent import answer_knowledge_question
    body = job['input']['body']
    progress('讀取已發布知識並回答問題')
    response = answer_knowledge_question(str(body.get('question') or ''),
        lang=str(body.get('lang') or 'zh-Hant'),
        top_k=max(1, min(int(body.get('top_k') or 6), 10)), history=body.get('history') or [])
    return {'message': '問答完成。', 'response': {'ok': True, **response}, 'needs_translation': False}
