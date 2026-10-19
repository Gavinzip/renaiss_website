FROM python:3.12-slim
WORKDIR /app
COPY requirements.worker.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt
COPY . /app/scripts/
ENV PYTHONUNBUFFERED=1
CMD ["python", "scripts/hub_worker.py"]
