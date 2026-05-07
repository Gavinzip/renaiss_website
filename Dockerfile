FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g mmx-cli@1.0.11

RUN python3 -m pip install --break-system-packages --no-cache-dir \
  requests \
  beautifulsoup4 \
  lxml \
  python-dotenv

COPY . .

ENV HOST=0.0.0.0
ENV PORT=8787
ENV NEWS_SEARCH_PROVIDER=mmx
ENV NEWS_LANGS=zh-Hant,zh-Hans,en,ko
ENV APP_ENV=server
ENV WEBSITE_STATIC_ROOT=website
ENV WEBSITE_DATA_ROOT=/data/RENAISS_WEBSITE
ENV WEBSITE_DATA_MIGRATE_ONCE=1
ENV WEBSITE_DATA_RESTORE_ON_STARTUP=0
ENV WEBSITE_DATA_RESTORE_POLICY=always
ENV WEBSITE_DATA_RESTORE_FORCE=0
ENV I18N_FEED_FALLBACK_MODE=base
ENV WEBSITE_BACKUP_ENABLED=0
ENV WEBSITE_BACKUP_PROVIDER=git
ENV WEBSITE_BACKUP_REPO=https://github.com/Gavinzip/webdata.git
ENV WEBSITE_BACKUP_SUBDIR=RENAISS_WEBSITE
ENV WEBSITE_BACKUP_REPO_DIR=/data/.renaiss_website_data_repo
ENV WEBSITE_BACKUP_TIMEZONE=Asia/Taipei
ENV WEBSITE_BACKUP_HOUR=0
ENV WEBSITE_BACKUP_MINUTE=10

CMD ["python3", "main.py"]
