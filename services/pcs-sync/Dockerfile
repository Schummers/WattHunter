# Official Playwright Python image — Chromium + all system deps pre-installed.
# Version must match playwright==1.49.0 in requirements.txt.
FROM mcr.microsoft.com/playwright/python:v1.49.0-focal

WORKDIR /app

# Install Python dependencies.
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 prevents a redundant browser download
# since browsers are already baked into the base image at /ms-playwright.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (see .dockerignore for exclusions)
COPY . .

# Railway injects PORT at runtime — fall back to 8000 for local dev.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
