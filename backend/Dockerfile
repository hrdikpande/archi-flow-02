# System libraries: Pango/HarfBuzz for WeasyPrint (cover sheets, watermarks, PDF exports),
# DejaVu fonts (include the ₹ glyph), Tesseract for scanned title blocks (F-50).
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH"
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core \
      tesseract-ocr tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.12.5 /uv /usr/local/bin/uv
WORKDIR /app

# Development and CI image: includes test and lint tools; the source is mounted at /app.
FROM base AS dev
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

FROM base AS prod
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN DJANGO_SECRET_KEY=build DATABASE_URL=sqlite:///tmp/build.db \
    python manage.py collectstatic --noinput --settings=config.settings.prod \
 && useradd --system --uid 10001 --home /app app && chown -R app /app
USER app
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
