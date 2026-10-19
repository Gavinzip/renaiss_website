"""Private mutation execution endpoint."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from hub_job_http import create_handler

class handler(create_handler('mutation')):
    pass
