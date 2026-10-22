# On Their Own: ein Container für API, WebSocket und das gebaute Frontend (kein Nginx, keine zweite Datenbank).
# Bauen: docker compose -f deploy/compose.yaml build   (Kontext ist das Projektverzeichnis)

# --- Stufe 1: Frontend bauen --------------------------------------------------------------------
FROM node:24-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Stufe 2: Laufzeit ----------------------------------------------------------------------------
FROM python:3.14-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    SIM_HOST=0.0.0.0 \
    SIM_PORT=8090 \
    SIM_DATA_DIR=/data \
    SIM_STATIC_DIR=/app/static

WORKDIR /app
# Abhängigkeiten aus der gepinnten Lock-Datei (backend/requirements.lock; erneuern: siehe docs/betrieb.md)
COPY backend/requirements.lock ./
RUN pip install --no-deps -r requirements.lock

# Nicht-Root-Benutzer; /data gehört ihm (ein neues Volume übernimmt diese Rechte)
RUN useradd --uid 10001 --user-group --no-create-home --shell /usr/sbin/nologin sim \
 && mkdir /data && chown sim:sim /data

COPY backend/simulacra ./simulacra
COPY --from=frontend /build/dist ./static

USER sim
VOLUME /data
EXPOSE 8090

# Der Healthcheck prüft nur die App; ein nicht erreichbares Modell macht sie nicht „unhealthy“ (sie bleibt bedienbar).
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,sys,urllib.request as u; sys.exit(0 if u.urlopen('http://127.0.0.1:%s/api/health' % os.environ['SIM_PORT'], timeout=4).status == 200 else 1)"

CMD ["python", "-m", "simulacra"]
