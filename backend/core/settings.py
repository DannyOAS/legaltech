"""Django settings for the Ontario legal tech SaaS platform."""
from __future__ import annotations

import json
import os
from datetime import timedelta
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Environment helpers ----------------------------------------------------

def env(key: str, default: str | None = None) -> str:
    value = os.getenv(key, default)
    if value is None:
        raise RuntimeError(f"Environment variable '{key}' is required")
    return value


def env_bool(key: str, default: bool = False) -> bool:
    return json.loads(os.getenv(key, str(default)).lower()) if os.getenv(key) else default


# --- Core settings ----------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-secret-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS: list[str] = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

SITE_NAME = "Maple Legal Platform"

# --- Applications -----------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "django_filters",
    "drf_spectacular",
    # Project apps
    "accounts",
    "matters",
    "billing",
    "portal",
    "client_portal",
    "case_rules",
    "integrations",
    "services.audit",
    "notifications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.TenantContextMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "core.wsgi.application"
ASGI_APPLICATION = "core.asgi.application"

# --- Database ---------------------------------------------------------------
def _database_config() -> Dict[str, Any]:
    default_db = "postgres://postgres:postgres@db:5432/legaltech"
    database_url = os.getenv("DATABASE_URL", default_db)
    from urllib.parse import urlparse

    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise RuntimeError("Only PostgreSQL connections are supported")

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username,
        "PASSWORD": parsed.password,
        "HOST": parsed.hostname,
        "PORT": parsed.port or 5432,
        "CONN_MAX_AGE": 600,
        "OPTIONS": {"sslmode": os.getenv("POSTGRES_SSL_MODE", "prefer")},
    }


DATABASES = {"default": _database_config()}

# --- Passwords & auth ------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
]

# --- Internationalization --------------------------------------------------
LANGUAGE_CODE = "en-ca"
TIME_ZONE = "America/Toronto"
USE_I18N = True
USE_TZ = True

# --- Static & media --------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF configuration -----------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.JWTCookieAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "config.throttling.BurstRateThrottle",
        "config.throttling.SustainedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "burst": os.getenv("API_THROTTLE_BURST", "60/min"),
        "sustained": os.getenv("API_THROTTLE_SUSTAINED", "500/hour"),
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

if DEBUG:
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["burst"] = "600/min"
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["sustained"] = "5000/hour"

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "ALGORITHM": "HS256",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "accounts.serializers.TokenObtainPairSerializer",
}

# Cookies for double-submit CSRF with JWT stored in httpOnly cookies
ACCESS_TOKEN_COOKIE_NAME = "mlp_access"
REFRESH_TOKEN_COOKIE_NAME = "mlp_refresh"
CSRF_TOKEN_COOKIE_NAME = "mlp_csrf"

# --- CORS / CSRF -----------------------------------------------------------
CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:5173").split(",")

CSRF_COOKIE_HTTPONLY = False  # double-submit pattern
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 60 if DEBUG else 31536000
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --- Security headers ------------------------------------------------------
CONTENT_SECURITY_POLICY = """default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"""

# --- Storage ---------------------------------------------------------------
CA_REGION = os.getenv("CA_REGION", "ca-central-1")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "https://storage.legal.getbukd.com")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "legaltech-dev")
S3_USE_PATH_STYLE = env_bool("S3_USE_PATH_STYLE", True)
S3_EXTERNAL_ENDPOINT_URL = os.getenv("S3_EXTERNAL_ENDPOINT_URL", "")

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
    "documents": {
        "BACKEND": "services.storage.backends.S3DocumentStorage",
        "OPTIONS": {
            "bucket_name": S3_BUCKET_NAME,
            "endpoint_url": S3_ENDPOINT_URL,
            "region_name": CA_REGION,
            "use_path_style": S3_USE_PATH_STYLE,
        },
    },
}

# --- Email & notifications -------------------------------------------------
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@maplelegal.ca")

# --- Stripe / payments stubs ----------------------------------------------
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_test_stub")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_stub")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
INTERAC_INSTRUCTIONS = "Set up Interac e-Transfer with finance@maplelegal.ca"

# --- Logging ---------------------------------------------------------------
LOGGING: Dict[str, Any] = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(asctime)s %(levelname)s %(name)s %(organization_id)s %(message)s",
        }
    },
    "filters": {
        "tenant": {
            "()": "services.audit.logging.TenantContextFilter",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
            "filters": ["tenant"],
        }
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}

# --- Audit / tenancy -------------------------------------------------------
AUDIT_EVENT_NAME = "mlp_audit"

# --- Swagger / schema ------------------------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": SITE_NAME,
    "DESCRIPTION": "Ontario-focused legal platform API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}


# --- AI service toggles ----------------------------------------------------
AI_PROVIDER = os.getenv("AI_PROVIDER", "mock")

# --- Feature flags ---------------------------------------------------------
FEATURE_CONTRACT_ANALYSIS = env_bool("FEATURE_CONTRACT_ANALYSIS", False)
FEATURE_CASE_TRACKER = env_bool("FEATURE_CASE_TRACKER", False)
FEATURE_AI_RESEARCH = env_bool("FEATURE_AI_RESEARCH", False)
