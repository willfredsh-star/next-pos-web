FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# collectstatic hanya butuh settings terbaca; nilai di bawah khusus saat build, bukan rahasia produksi.
RUN DJANGO_DEBUG=0 DB_ENGINE=sqlite REQUIRE_EMAIL_VERIFICATION=0 DJANGO_SECRET_KEY=build-time-only-not-a-real-secret-0123456789 \
    python manage.py collectstatic --noinput

RUN useradd --create-home --uid 10001 app && chown -R app:app /app
USER app
EXPOSE 8000
# Di dalam container, percayai proxy di jaringan Docker/ingress.
ENV FORWARDED_ALLOW_IPS="*"
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn nextpos.wsgi:application --config gunicorn.conf.py"]
