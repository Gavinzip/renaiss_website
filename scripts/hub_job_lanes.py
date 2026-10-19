"""Only knowledge questions use the independent read/answer lane."""


def is_agent_job(job: dict) -> bool:
    return job.get('kind') == 'action' and (job.get('input') or {}).get('path') == '/api/intel/agent'
