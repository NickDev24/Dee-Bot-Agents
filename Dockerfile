FROM python:3.12-slim

LABEL maintainer="Facu (NickDev24)"
LABEL org.opencontainers.image.title="Dee-Bot-Agents v4.0 Supreme"
LABEL org.opencontainers.image.description="Autonomous Physical & Multi-Agent System with Ears, Eyes, Voice, 3D HUD & Cluster Orchestrator"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    DEE_PORT=8091

# Install lightweight audio/video utilities (ALSA, FFmpeg, curl, openssh-client)
RUN apt-get update && apt-get install -y --no-install-recommends \
    alsa-utils \
    ffmpeg \
    curl \
    openssh-client \
    ca-certificates \
    && pip install --no-cache-dir edge-tts \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files (including pre-built frontend/dist)
COPY config/ /app/config/
COPY core/ /app/core/
COPY node_agent/ /app/node_agent/
COPY cli/ /app/cli/
COPY scripts/ /app/scripts/
COPY frontend/dist/ /app/frontend/dist/
COPY pyproject.toml README.md LICENSE /app/

# Create runtime data directories
RUN mkdir -p /app/data/biometrics \
             /app/data/media/conservar/intrusos \
             /app/data/media/descartable \
             /app/data/memory \
             /app/data/skills \
             /app/data/routines \
             /app/data/tts_cache \
             /app/data/logs \
    && chmod +x /app/cli/dee_cli.py /app/scripts/*.sh

EXPOSE 8091 8730 8731

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${DEE_PORT}/health || exit 1

CMD ["python3", "-m", "core.main"]
