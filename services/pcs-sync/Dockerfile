# Python slim + Playwright Chromium installed at build time.
# Avoids dependency on mcr.microsoft.com/playwright/python which is unreliable on Railway.
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Chromium + all system dependencies via Playwright CLI
RUN playwright install chromium --with-deps

# Copy application code (see .dockerignore for exclusions)
COPY . .

# Railway injects PORT at runtime — fall back to 8000 for local dev.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
