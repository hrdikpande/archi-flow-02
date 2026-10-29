"""Settings shared by every environment. Values come from the environment (docs/02 §14)."""

from datetime import timedelta
from pathlib import Path

import environ
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR.parent / ".env", overwrite=False)

# "development" | "test" | "staging" | "production". Real email is only allowed in production.
ENVIRONMENT = env("DJANGO_ENVIRONMENT", default="development")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])
# Public origin of the SPA; used for SSO callback and email links.
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:8080")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "drf_spectacular",
    "django_celery_beat",
    "django_prometheus",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.microsoft",
    "allauth.mfa",
    "allauth.headless",
    # Domain apps (docs/02 §4)
    "apps.core",
    "apps.accounts",
    "apps.projects",
    "apps.register",
    "apps.workflow",
    "apps.transmittals",
    "apps.automation",
    "apps.people",
    "apps.dashboards",
    "apps.search",
    "apps.exports",
    "apps.comments",
    "apps.billing",
    "apps.cadsync",
    "apps.ca",
    "apps.coordination",
    "apps.knowledge",
    "apps.intelligence",
    "apps.contacts",
    "apps.audit",
    "apps.outbox",
    "apps.files",
    "apps.notifications",
]

MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "apps.core.middleware.RequestContextMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # Serves /django-static/ (Django admin only) where no Caddy fronts the app (Railway).
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "apps.core.middleware.SecurityHeadersMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.RequestUserContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["ATOMIC_REQUESTS"] = False
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DATABASE_CONN_MAX_AGE", default=60)
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("CACHE_URL", default="redis://localhost:6379/1"),
        # Managed Redis (Upstash) closes idle connections: check them before use.
        "OPTIONS": {"health_check_interval": 30, "socket_keepalive": True},
    }
}

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Localisation (N-08): English UI, IST default; display formats live in the SPA.
LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/django-static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- Sessions and CSRF (docs/02 §11): one origin behind Caddy -----------------------------
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 12
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # the SPA reads it and echoes it in X-CSRFToken

# --- allauth: SSO + local accounts with TOTP (F-40, I-11) --------------------------------
ACCOUNT_ADAPTER = "apps.accounts.adapters.AccountAdapter"
SOCIALACCOUNT_ADAPTER = "apps.accounts.adapters.SocialAccountAdapter"
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_LOGIN_ON_PASSWORD_RESET = False
# Per account: 5 failures in 5 min (the brute-force control). Per IP: sized for a whole office
# behind one NAT address signing in at 9 am (DD-038).
ACCOUNT_RATE_LIMITS = {"login": "120/m/ip", "login_failed": "20/m/ip,5/5m/key"}
# allauth rate-limits by the client IP that RequestContextMiddleware resolved from the trusted
# proxies (TRUSTED_PROXY_COUNT), never the proxy's address shared by every user (DD-038).
ALLAUTH_TRUSTED_CLIENT_IP_HEADER = "X-DrawingOps-Client-IP"
SOCIALACCOUNT_ONLY = False
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION = False
SOCIALACCOUNT_STORE_TOKENS = False
# Only the firm's domains may sign in with SSO (docs/06 R-22).
SSO_ALLOWED_DOMAINS = [d.lower() for d in env.list("SSO_ALLOWED_DOMAINS", default=[])]


def _sso_providers() -> dict[str, dict]:
    providers: dict[str, dict] = {}
    if env("SSO_GOOGLE_CLIENT_ID", default=""):
        providers["google"] = {
            "APPS": [
                {
                    "client_id": env("SSO_GOOGLE_CLIENT_ID"),
                    "secret": env("SSO_GOOGLE_CLIENT_SECRET"),
                }
            ],
            "SCOPE": ["openid", "email", "profile"],
            "AUTH_PARAMS": {"prompt": "select_account"},
        }
    if env("SSO_MICROSOFT_CLIENT_ID", default=""):
        providers["microsoft"] = {
            "APPS": [
                {
                    "client_id": env("SSO_MICROSOFT_CLIENT_ID"),
                    "secret": env("SSO_MICROSOFT_CLIENT_SECRET"),
                    "settings": {"tenant": env("SSO_MICROSOFT_TENANT", default="organizations")},
                }
            ],
        }
    return providers


SOCIALACCOUNT_PROVIDERS = _sso_providers()

MFA_SUPPORTED_TYPES = ["totp", "recovery_codes"]
MFA_TOTP_ISSUER = "DrawingOps"

HEADLESS_ONLY = True
HEADLESS_CLIENTS = ("browser",)
HEADLESS_FRONTEND_URLS = {
    "account_signup": f"{FRONTEND_URL}/sign-in",
    "socialaccount_login_error": f"{FRONTEND_URL}/sign-in?error=sso",
    "account_reset_password_from_key": f"{FRONTEND_URL}/sign-in",
}
LOGIN_REDIRECT_URL = "/"

# --- REST API (docs/02 §12) ----------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.ApiTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "apps.accounts.drf_permissions.IsActiveOrgMember",
        "apps.accounts.drf_permissions.TokenScopePermission",
        "apps.accounts.drf_permissions.MfaSatisfied",
        "apps.accounts.drf_permissions.ActionPermission",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultCursorPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_RATES": {"user": "600/min", "anon": "60/min"},
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}
SPECTACULAR_SETTINGS = {
    "TITLE": "DrawingOps API",
    "DESCRIPTION": "Drawing and deliverable control. See docs/02 §12.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAuthenticated"],
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "OrgRoleEnum": "apps.accounts.roles.OrgRole",
        "ProjectRoleEnum": "apps.accounts.roles.ProjectRole",
        "ExternalOrgKindEnum": "apps.contacts.models.ExternalOrgKind",
        "UploadKindEnum": "apps.files.models.UploadKind",
        "UploadStateEnum": "apps.files.models.UploadState",
        "SheetStateEnum": "apps.register.models.SheetState",
        "RevisionStateEnum": "apps.register.models.RevisionState",
        "StageStateEnum": "apps.projects.models.StageState",
        "ProjectStatusEnum": "apps.projects.models.ProjectStatus",
        "ProjectTypeEnum": "apps.projects.models.ProjectType",
        "NamingTargetEnum": "apps.register.models.NamingTarget",
        "ExportKindEnum": "apps.exports.models.ExportKind",
        "ExportFormatEnum": "apps.exports.models.ExportFormat",
        "ExportStateEnum": "apps.exports.models.ExportState",
        "TimesheetStateEnum": "apps.people.models.TimesheetState",
        "LeaveTypeEnum": "apps.people.models.LeaveType",
        "CommentSourceEnum": "apps.comments.models.CommentSource",
        "CommentStatusEnum": "apps.comments.models.CommentStatus",
        "InboundStateEnum": "apps.comments.models.InboundState",
        "SyncSourceEnum": "apps.cadsync.models.SyncSource",
        "ProposalKindEnum": "apps.cadsync.models.ProposalKind",
        "ProposalStateEnum": "apps.cadsync.models.ProposalState",
        "PartyEnum": "apps.ca.models.Party",
        "RfiStatusEnum": "apps.ca.models.RfiStatus",
        "SubmittalKindEnum": "apps.ca.models.SubmittalKind",
        "SubmittalStatusEnum": "apps.ca.models.SubmittalStatus",
        "ReportStateEnum": "apps.ca.models.ReportState",
        "ChangeOriginEnum": "apps.ca.models.ChangeOrigin",
        "ChangeStatusEnum": "apps.ca.models.ChangeStatus",
        "ClashSourceEnum": "apps.coordination.models.ClashSource",
        "ClashStatusEnum": "apps.coordination.models.ClashStatus",
        "ModelKindEnum": "apps.intelligence.models.ModelKind",
        "RunStatusEnum": "apps.intelligence.models.RunStatus",
        "FindingStatusEnum": "apps.intelligence.models.FindingStatus",
    },
}

# --- Object storage (F-41, docs/02 §9) ------------------------------------------------------
S3_BUCKET = env("S3_BUCKET", default="drawingops")
S3_REGION = env("S3_REGION", default="ap-south-1")
S3_ENDPOINT_URL = env("S3_ENDPOINT_URL", default=None)
# Presigned URLs: either signed for the origin the request came from (Caddy forwards
# /<bucket>/* to storage, so no CORS; DD-006), or for a fixed public endpoint (cloud S3).
S3_PRESIGN_VIA_APP_ORIGIN = env.bool("S3_PRESIGN_VIA_APP_ORIGIN", default=False)
S3_PUBLIC_ENDPOINT_URL = env("S3_PUBLIC_ENDPOINT_URL", default=None)
S3_ACCESS_KEY_ID = env("S3_ACCESS_KEY_ID", default=None)
S3_SECRET_ACCESS_KEY = env("S3_SECRET_ACCESS_KEY", default=None)
S3_SERVER_SIDE_ENCRYPTION = env("S3_SERVER_SIDE_ENCRYPTION", default="")
UPLOAD_MAX_BYTES = env.int("UPLOAD_MAX_BYTES", default=200 * 1024 * 1024)  # N-03
UPLOAD_URL_EXPIRY = timedelta(minutes=15)

# --- Email (I-12). Non-production may only talk to a local catcher (CLAUDE.md). ----------
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=1025)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=False)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)  # port 465; TLS (587) is the usual
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=20)
SERVER_EMAIL = env(
    "SERVER_EMAIL",
    default=env("DEFAULT_FROM_EMAIL", default="DrawingOps <no-reply@drawingops.local>"),
)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="DrawingOps <no-reply@drawingops.local>")
NON_PRODUCTION_EMAIL_HOSTS = {"localhost", "127.0.0.1", "mailpit"}

# --- Celery (docs/02 §2): queues default, pdf, email, sweeps -------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BROKER_TRANSPORT_OPTIONS = {
    "visibility_timeout": 3600,
    "socket_keepalive": True,
    "health_check_interval": 30,
}
if CELERY_BROKER_URL.startswith("rediss://"):
    import ssl

    # Upstash and other managed Redis use TLS; kombu needs the certificate policy explicitly.
    CELERY_BROKER_USE_SSL = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
CELERY_RESULT_BACKEND = None
CELERY_TASK_IGNORE_RESULT = True
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_TASK_ROUTES = {
    "apps.files.tasks.*": {"queue": "pdf"},
    "apps.notifications.tasks.*": {"queue": "email"},
    "apps.automation.tasks.*": {"queue": "sweeps"},
    "apps.dashboards.tasks.*": {"queue": "sweeps"},
    "apps.exports.tasks.*": {"queue": "pdf"},
    "apps.comments.tasks.*": {"queue": "email"},
    "apps.intelligence.tasks.*": {"queue": "sweeps"},
}
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
# Keep Django's JSON logging (with request IDs) in workers instead of Celery's format (N-05).
CELERY_WORKER_HIJACK_ROOT_LOGGER = False
CELERY_BEAT_SCHEDULE = {
    "outbox-safety-sweep": {
        "task": "apps.outbox.tasks.dispatch_pending",
        "schedule": 30.0,
    },
    "beat-heartbeat": {
        "task": "apps.core.tasks.heartbeat",
        "schedule": 60.0,
    },
    "automation-sweeps": {
        "task": "apps.automation.tasks.run_due_sweeps",
        "schedule": crontab(minute="*/15"),
    },
    "notification-digests": {
        "task": "apps.notifications.tasks.send_due_digests",
        "schedule": crontab(minute="*/15"),
    },
    "dashboards-refresh": {
        "task": "apps.dashboards.tasks.refresh",
        "schedule": crontab(minute="*/5"),
    },
    "weekly-owner-summary": {
        "task": "apps.dashboards.tasks.send_owner_summaries",
        "schedule": crontab(minute="*/15"),
    },
    "intelligence-weekly": {
        "task": "apps.intelligence.tasks.weekly",
        "schedule": crontab(minute=0, hour=5, day_of_week=1),  # Monday 05:00 (P4, T-09)
    },
    "inbound-mail": {
        "task": "apps.comments.tasks.poll_inbound_mail",
        "schedule": 60.0,  # F-25: comments appear within 5 minutes
    },
    "purge-stale-uploads": {
        "task": "apps.files.tasks.purge_stale_uploads",
        "schedule": crontab(minute=15, hour=3),
    },
}
# /healthz reports beat as stale when the heartbeat is older than this (N-05).
BEAT_STALE_AFTER = timedelta(minutes=env.int("BEAT_STALE_AFTER_MINUTES", default=5))
# Behind Vercel (rewrite) → Railway edge the client is the 2nd-last X-Forwarded-For entry;
# behind Caddy alone it is the last (1).
TRUSTED_PROXY_COUNT = env.int("TRUSTED_PROXY_COUNT", default=1)
# Sent on every response that has none (the SPA host sets its own; deploy/vercel, Caddyfile).
CONTENT_SECURITY_POLICY = env(
    "CONTENT_SECURITY_POLICY",
    default=(
        "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "
        "connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; "
        "form-action 'self'"
    ),
)
# Vercel Cron / Railway cron alternative to Celery beat (POST /integrations/cron/tick).
CRON_SECRET = env("CRON_SECRET", default="")
# Outbound webhooks may reach private addresses (local development only; never in production).
OUTBOUND_ALLOW_PRIVATE = (
    env.bool("OUTBOUND_ALLOW_PRIVATE", default=False) and ENVIRONMENT != "production"
)
OUTBOX_MAX_ATTEMPTS = 8
# F-25 / I-09 inbound client email: p-<project code>@INBOUND_EMAIL_DOMAIN. Delivered by the
# mail provider's webhook (POST /integrations/inbound-email with X-Inbound-Secret) or polled.
INBOUND_EMAIL_DOMAIN = env("INBOUND_EMAIL_DOMAIN", default="inbound.drawingops.local")
INBOUND_EMAIL_SECRET = env("INBOUND_EMAIL_SECRET", default="")
INBOUND_IMAP_HOST = env("INBOUND_IMAP_HOST", default="")
INBOUND_IMAP_PORT = env.int("INBOUND_IMAP_PORT", default=993)
INBOUND_IMAP_USER = env("INBOUND_IMAP_USER", default="")
INBOUND_IMAP_PASSWORD = env("INBOUND_IMAP_PASSWORD", default="")
INBOUND_IMAP_FOLDER = env("INBOUND_IMAP_FOLDER", default="INBOX")
# F-52: larger exports run in the background and email a link.
EXPORT_SYNC_MAX_ROWS = env.int("EXPORT_SYNC_MAX_ROWS", default=5000)

# --- Observability (N-05) -------------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_context": {"()": "apps.core.logging.RequestContextFilter"}},
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.json.JsonFormatter",
            "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s %(user_id)s",
            "rename_fields": {"asctime": "time", "levelname": "level"},
        },
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["request_context"],
        },
    },
    "root": {"handlers": ["stdout"], "level": LOG_LEVEL},
    "loggers": {"django.db.backends": {"level": "WARNING"}},
}

SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=ENVIRONMENT,
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0),
        send_default_pii=False,
    )
