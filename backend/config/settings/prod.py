"""Production and staging: behind Caddy (deploy/docker-compose.prod.yml) or on Railway behind
Vercel (deploy/railway, deploy/vercel). TLS terminates at the edge."""

from .base import *  # noqa: F403
from .base import env

DEBUG = False
# Production sends real email through the firm's SMTP provider (EMAIL_HOST, EMAIL_PORT,
# EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS, DEFAULT_FROM_EMAIL).
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
SESSION_COOKIE_NAME = (
    "__Host-sessionid" if env.bool("DJANGO_SECURE_COOKIES", default=True) else "sessionid"
)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_REDIRECT_EXEMPT = [r"^healthz$", r"^livez$"]
SESSION_COOKIE_SECURE = env.bool("DJANGO_SECURE_COOKIES", default=True)
CSRF_COOKIE_SECURE = env.bool("DJANGO_SECURE_COOKIES", default=True)
SECURE_HSTS_SECONDS = env.int("DJANGO_HSTS_SECONDS", default=31_536_000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# Preloading binds the whole domain to HTTPS in browsers for good: the firm decides (DEC-01).
SECURE_HSTS_PRELOAD = env.bool("DJANGO_HSTS_PRELOAD", default=False)
SILENCED_SYSTEM_CHECKS = [] if SECURE_HSTS_PRELOAD else ["security.W021"]
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ],
}
