"""Single-job process, isolated from legacy module globals of previous jobs."""
import json
from pathlib import Path
import sys

from hub_job_store import job_store
from hub_pipeline import run_pipeline

job_path, result_path = map(Path, sys.argv[1:3])
job = json.loads(job_path.read_text())["job"]
try:
    result = run_pipeline(job, job_path.parent, lambda phase: job_store().heartbeat(job, phase))
    result_path.write_text(json.dumps(result, ensure_ascii=False))
except Exception as exc:
    result_path.write_text(str(exc))
    raise
