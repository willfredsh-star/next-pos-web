import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name, default=''):
    return [x.strip() for x in os.getenv(name, default).split(',') if x.strip()]


# Aman secara default: DEBUG mati kecuali dinyalakan eksplisit (DJANGO_DEBUG=1) untuk pengembangan lokal.
DEBUG = env_bool('DJANGO_DEBUG', False)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'dev-only-insecure-key-do-not-use-in-production'
    else:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY wajib diisi saat DJANGO_DEBUG=0.')
elif not DEBUG and (SECRET_KEY.startswith('change-this') or SECRET_KEY.startswith('generate-your-own') or len(SECRET_KEY) < 32):
    raise ImproperlyConfigured('DJANGO_SECRET_KEY terlalu lemah/masih contoh. Gunakan nilai acak minimal 32 karakter.')

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1' if DEBUG else '')
# Hostless internal health probes may use private IPs; middleware rewrites only /api/health/ to localhost.
if 'localhost' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('localhost')
# Render menyediakan hostname publik layanan lewat RENDER_EXTERNAL_HOSTNAME; otomatis diizinkan.
_render_host = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if _render_host and _render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_render_host)
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', '')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'core.middleware.InternalHealthProbeHostMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'nextpos.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'nextpos.wsgi.application'

if os.getenv('DB_ENGINE', 'mysql').lower() == 'sqlite':
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
else:
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('DB_NAME', 'next_pos'),
        'USER': os.getenv('DB_USER', 'next_pos_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('DB_PORT', '3306'),
        'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', '60')),
        'OPTIONS': {'charset': 'utf8mb4'},
    }}
    # Penyedia MySQL terkelola (mis. TiDB Cloud) mewajibkan TLS: set DB_SSL=1 (CA sistem dipakai bila DB_SSL_CA kosong).
    if env_bool('DB_SSL', False):
        DATABASES['default']['OPTIONS']['ssl'] = {'ca': os.getenv('DB_SSL_CA', '/etc/ssl/certs/ca-certificates.crt')}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'id-id'
TIME_ZONE = 'Asia/Jakarta'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---- Auth & throttling ----
# Token kedaluwarsa setelah TOKEN_TTL_DAYS hari sejak dibuat (login ulang akan menerbitkan token baru).
TOKEN_TTL_DAYS = int(os.getenv('TOKEN_TTL_DAYS', '30'))
# Jumlah reverse proxy (nginx/load balancer) di depan aplikasi, supaya throttle membaca IP klien yang benar.
NUM_PROXIES = int(os.getenv('DJANGO_NUM_PROXIES', '0' if DEBUG else '1'))
# Pendaftaran manajer terbuka untuk umum. Set ke 0 untuk menutupnya setelah akun yang dibutuhkan dibuat.
ALLOW_REGISTRATION = env_bool('ALLOW_REGISTRATION', True)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['core.authentication.ExpiringTokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.ScopedRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {
        'login': os.getenv('THROTTLE_LOGIN', '10/min'),
        'register': os.getenv('THROTTLE_REGISTER', '5/hour'),
        'verify': os.getenv('THROTTLE_VERIFY', '20/hour'),
        'resend': os.getenv('THROTTLE_RESEND', '5/hour'),
    },
    'NUM_PROXIES': NUM_PROXIES,
    'EXCEPTION_HANDLER': 'core.exceptions.api_exception_handler',
}

# Throttle menyimpan hitungan di cache. Bawaan (LocMemCache) hanya per proses; jika gunicorn memakai >1 worker,
# isi CACHE_DB_TABLE (mis. nextpos_cache) lalu jalankan `python manage.py createcachetable` agar hitungan dibagi bersama.
if os.getenv('CACHE_DB_TABLE'):
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.db.DatabaseCache', 'LOCATION': os.getenv('CACHE_DB_TABLE')}}

# ---- Aturan bisnis POS (dihitung SERVER, tidak pernah dipercaya dari klien) ----
POS_TAX_RATE = float(os.getenv('POS_TAX_RATE', '0.11'))
POS_MAX_DISCOUNT_PERCENT = float(os.getenv('POS_MAX_DISCOUNT_PERCENT', '100'))
POS_MAX_LINE_QTY = int(os.getenv('POS_MAX_LINE_QTY', '99'))
POS_MAX_LINES = int(os.getenv('POS_MAX_LINES', '60'))
# Batas ukuran gambar menu (data URL) dalam karakter.
POS_MAX_IMAGE_CHARS = int(os.getenv('POS_MAX_IMAGE_CHARS', '400000'))

CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')

# ---- Keamanan produksi ----
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if env_bool('DJANGO_BEHIND_PROXY', True) else None
    SECURE_SSL_REDIRECT = False
    SECURE_REDIRECT_EXEMPT = [r'^api/health/$']  # healthcheck load balancer lewat HTTP biasa
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('DJANGO_HSTS_SUBDOMAINS', False)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'

ENABLE_ADMIN = env_bool('DJANGO_ENABLE_ADMIN', DEBUG)

# ---- Verifikasi email manajer & pengiriman email ----
# Manajer baru wajib membuka tautan di emailnya sebelum bisa masuk. Matikan (0) hanya bila SMTP belum siap.
REQUIRE_EMAIL_VERIFICATION = env_bool('REQUIRE_EMAIL_VERIFICATION', True)
EMAIL_VERIFY_TTL_HOURS = int(os.getenv('EMAIL_VERIFY_TTL_HOURS', '48'))
# Alamat publik frontend, dipakai untuk membuat tautan di email (mis. https://pos.example.com).
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'http://localhost:5173' if DEBUG else '')
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_SSL = env_bool('EMAIL_USE_SSL', False)
EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', not EMAIL_USE_SSL)
EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '10'))
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'NEXT POS <noreply@localhost>')
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Tanpa EMAIL_HOST, email hanya dicetak ke konsol (cukup untuk pengembangan lokal).

if REQUIRE_EMAIL_VERIFICATION and not DEBUG:
    _missing = [name for name, ok in (
        ('EMAIL_HOST (atau EMAIL_BACKEND)', bool(EMAIL_HOST or os.getenv('EMAIL_BACKEND'))),
        ('DEFAULT_FROM_EMAIL', bool(os.getenv('DEFAULT_FROM_EMAIL'))),
        ('FRONTEND_BASE_URL', bool(FRONTEND_BASE_URL)),
    ) if not ok]
    if _missing:
        raise ImproperlyConfigured(
            'Verifikasi email aktif tetapi pengaturan berikut belum diisi: ' + ', '.join(_missing)
            + '. Isi di .env, atau set REQUIRE_EMAIL_VERIFICATION=0 untuk mematikan verifikasi.'
        )

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'plain': {'format': '%(asctime)s %(levelname)s %(name)s: %(message)s'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'plain'}},
    'root': {'handlers': ['console'], 'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO')},
}
