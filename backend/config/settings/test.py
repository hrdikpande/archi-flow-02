import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-not-secret")
os.environ.setdefault("DJANGO_ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "postgres://drawingops:drawingops@localhost:5432/drawingops")

from .base import *  # noqa: F403

ENVIRONMENT = "test"
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
S3_BUCKET = "test-bucket"
S3_ENDPOINT_URL = None
S3_PUBLIC_ENDPOINT_URL = None
S3_ACCESS_KEY_ID = "test"
S3_SECRET_ACCESS_KEY = "test"
SSO_ALLOWED_DOMAINS = ["firm.example"]
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405
LOGGING = {"version": 1, "disable_existing_loggers": False}
INBOUND_EMAIL_DOMAIN = "inbound.test"
INBOUND_EMAIL_SECRET = "test-inbound-secret"

# Static files are collected only in the production image.
WHITENOISE_AUTOREFRESH = True
