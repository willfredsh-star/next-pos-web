import time
from datetime import date, datetime, time as datetime_time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import connection, transaction as db_transaction
from django.db.models import Max, Q
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import issue_token
from .models import Employee, Shift, Transaction, TransactionItem, Product
from .serializers import AccountSerializer, ShiftSerializer, TransactionSerializer, ProductSerializer
from .verification import send_verification_email, user_for_token

MIN_PASSWORD = 8
ORDER_TYPES = ('Makan di tempat', 'Bawa pulang')
MAX_ORDER_SUBTOTAL = 2_000_000_000  # kolom integer unsigned MySQL maksimal ~4,29 miliar (termasuk pajak)


def account_data(employee): return AccountSerializer(employee).data
def error(message, code=400): return Response({'error': message}, status=code)
def employee_for(user):
    try: return user.employee
    except Employee.DoesNotExist: return None

def require_manager(request):
    actor = employee_for(request.user)
    if not actor or actor.role != 'manager' or not actor.active: return None
    return actor

def manager_cashiers(manager):
    # Kasir milik satu restoran = kasir yang didaftarkan oleh manajer tsb (Employee.created_by).
    # Semua data kasir/shift/transaksi untuk manajer HARUS lewat queryset ini.
    return Employee.objects.filter(role='cashier', created_by=manager)

def manager_of(employee):
    # Manajer pemilik restoran: manajer itu sendiri, atau manajer yang mendaftarkan kasir.
    if employee.role == 'manager': return employee
    return employee.created_by

def next_order_number(manager):
    # Nomor berikutnya hanya dihitung dari transaksi milik manajer ini. Panggil di dalam transaksi DB.
    last = Transaction.objects.filter(manager=manager).aggregate(m=Max('number'))['m'] or 0
    return last + 1

def menu_for(employee):
    # Menu milik satu restoran = menu milik manajernya (manajer itu sendiri, atau manajer yang mendaftarkan kasir).
    owner_id = employee.pk if employee.role == 'manager' else employee.created_by_id
    return Product.objects.filter(owner_id=owner_id) if owner_id else Product.objects.none()

def body(request):
    # request.data bisa berupa list/string jika klien mengirim JSON non-objek; anggap kosong.
    return request.data if hasattr(request.data, 'get') else {}

def identity_error(name, email):
    if len(name) < 2: return 'Nama lengkap minimal 2 karakter.'
    if len(name) > 150: return 'Nama terlalu panjang (maksimal 150 karakter).'
    if '@' not in email or '.' not in email.split('@')[-1] or len(email) > 150: return 'Masukkan alamat email yang valid.'
    return None

def password_error(password, name='', email=''):
    if len(password) < MIN_PASSWORD: return f'Kata sandi minimal {MIN_PASSWORD} karakter.'
    try:
        validate_password(password, user=User(username=email, email=email, first_name=name))
    except ValidationError as exc:
        return ' '.join(exc.messages)
    return None

def as_id(value):
    # ID dari klien bisa berupa angka atau string angka ("12"); selain itu dianggap tidak valid (None).
    if type(value) is int and 0 < value < 2**62: return value
    if isinstance(value, str) and value.isdigit() and len(value) < 19: return int(value)
    return None

def round_half_up(value):
    return int(Decimal(value).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        try:
            connection.ensure_connection()
        except Exception:
            return Response({'status': 'error', 'service': 'NEXT POS API'}, status=503)
        return Response({'status': 'ok', 'service': 'NEXT POS API'})

class RegisterManagerView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'register'
    def post(self, request):
        if not settings.ALLOW_REGISTRATION: return error('Pendaftaran manajer baru sedang ditutup.', 403)
        data = body(request)
        name = str(data.get('name', '')).strip(); email = str(data.get('email', '')).strip().lower(); password = str(data.get('password', ''))
        issue = identity_error(name, email) or password_error(password, name, email)
        if issue: return error(issue)
        existing = User.objects.filter(username=email).first()
        if existing:
            pending = employee_for(existing)
            if settings.REQUIRE_EMAIL_VERIFICATION and pending and pending.role == 'manager' and not pending.email_verified:
                return Response({'error': 'Email ini sudah terdaftar tetapi belum diverifikasi. Periksa kotak masuk Anda atau kirim ulang email verifikasi.', 'code': 'email_not_verified'}, status=400)
            return error('Email ini sudah terdaftar. Silakan masuk.')
        verify = settings.REQUIRE_EMAIL_VERIFICATION
        with db_transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password, first_name=name)
            employee = Employee.objects.create(user=user, title='Manajer toko', role='manager', active=True, email_verified=not verify, created_at=int(time.time() * 1000))
            token = None if verify else issue_token(user)
        if verify:
            # Belum ada token sesi: manajer baru harus membuka tautan di emailnya dulu.
            sent = send_verification_email(user)
            return Response({'verificationRequired': True, 'emailSent': sent, 'email': email}, status=201)
        return Response({'account': account_data(employee), 'token': token.key}, status=201)

class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'verify'
    def post(self, request):
        user = user_for_token(body(request).get('token'))
        employee = employee_for(user) if user else None
        if not employee or employee.role != 'manager':
            return error('Tautan verifikasi tidak valid atau sudah kedaluwarsa. Minta email verifikasi baru.')
        if not employee.email_verified:
            employee.email_verified = True
            employee.save(update_fields=['email_verified'])
        return Response({'ok': True, 'email': user.email})

class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'resend'
    def post(self, request):
        # Jawaban selalu sama supaya alamat email yang terdaftar tidak bisa ditebak dari sini.
        generic = Response({'ok': True, 'message': 'Jika email terdaftar dan belum diverifikasi, email verifikasi baru telah dikirim.'})
        email = str(body(request).get('email', '')).strip().lower()
        if not settings.REQUIRE_EMAIL_VERIFICATION or '@' not in email: return generic
        user = User.objects.filter(username=email).first()
        employee = employee_for(user) if user else None
        if not employee or employee.role != 'manager' or employee.email_verified: return generic
        if not cache.add(f'nextpos-verify-cooldown:{user.pk}', 1, 60): return generic  # maksimal 1 email per menit per akun
        send_verification_email(user)
        return generic

class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'login'
    def post(self, request):
        data = body(request)
        email = str(data.get('email', '')).strip().lower(); password = str(data.get('password', ''))
        if '@' not in email: return error('Masukkan alamat email yang valid.')
        user = authenticate(request, username=email, password=password)
        if not user: return error('Email atau kata sandi salah.', 401)
        employee = employee_for(user)
        if not employee: return error('Akun tidak memiliki profil pekerja.', 403)
        if not employee.active: return error('Akun ini dinonaktifkan. Hubungi manajer Anda.', 403)
        if employee.role == 'manager' and not employee.email_verified:
            return Response({'error': 'Email belum diverifikasi. Buka tautan di email Anda atau kirim ulang email verifikasi.', 'code': 'email_not_verified'}, status=403)
        token = issue_token(user)
        return Response({'account': account_data(employee), 'token': token.key})

class LogoutView(APIView):
    def post(self, request):
        request.auth.delete()
        return Response({'ok': True})

class BootstrapView(APIView):
    def get(self, request):
        me = employee_for(request.user)
        if not me or not me.active: return error('Akun tidak aktif.', 403)
        if me.role == 'manager':
            cashiers = manager_cashiers(me).select_related('user').order_by('id')
            shifts = Shift.objects.filter(cashier__created_by=me).order_by('-started_at')
            transactions = Transaction.objects.filter(cashier__created_by=me).order_by('-at').prefetch_related('lines')
        else:
            cashiers = Employee.objects.filter(pk=me.pk).select_related('user')
            shifts = Shift.objects.filter(cashier=me).order_by('-started_at')
            transactions = Transaction.objects.filter(cashier=me).order_by('-at').prefetch_related('lines')
        manager = manager_of(me)
        next_number = next_order_number(manager) if manager else 1
        return Response({
            'nextOrderNumber': next_number,
            'taxRate': settings.POS_TAX_RATE,
            'account': account_data(me),
            'cashiers': AccountSerializer(cashiers, many=True).data,
            'shifts': ShiftSerializer(shifts[:2000], many=True).data,
            'transactions': TransactionSerializer(transactions[:5000], many=True).data,
            'products': ProductSerializer(menu_for(me).order_by('id'), many=True).data,
        })

class ProfileView(APIView):
    def patch(self, request):
        employee = employee_for(request.user)
        if not employee: return error('Akun tidak ditemukan.', 404)
        data = body(request)
        name = str(data.get('name', '')).strip(); title = str(data.get('title', '')).strip()
        if len(name) < 2: return error('Nama lengkap minimal 2 karakter.')
        if len(name) > 150: return error('Nama terlalu panjang (maksimal 150 karakter).')
        if len(title) > 120: return error('Jabatan terlalu panjang (maksimal 120 karakter).')
        employee.user.first_name = name; employee.user.save(update_fields=['first_name'])
        if title: employee.title = title
        employee.save()
        return Response(account_data(employee))

class CashierCollectionView(APIView):
    def post(self, request):
        actor = require_manager(request)
        if not actor: return error('Hanya manajer yang dapat mendaftarkan kasir.', 403)
        data = body(request)
        name = str(data.get('name', '')).strip(); email = str(data.get('email', '')).strip().lower(); password = str(data.get('password', '')); title = str(data.get('title', 'Kasir')).strip() or 'Kasir'
        if len(title) > 120: return error('Jabatan terlalu panjang (maksimal 120 karakter).')
        issue = identity_error(name, email) or password_error(password, name, email)
        if issue: return error(issue)
        if User.objects.filter(username=email).exists(): return error('Email ini sudah terdaftar.')
        with db_transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password, first_name=name)
            employee = Employee.objects.create(user=user, title=title, role='cashier', active=True, created_at=int(time.time() * 1000), created_by=actor)
        return Response(account_data(employee), status=201)
    def patch(self, request):
        actor = require_manager(request)
        if not actor: return error('Hanya manajer yang dapat mengubah status kasir.', 403)
        data = body(request)
        target = manager_cashiers(actor).filter(pk=as_id(data.get('id'))).select_related('user').first()
        if not target: return error('Kasir tidak ditemukan.', 404)
        target.active = data.get('active') is True; target.save(update_fields=['active'])
        if not target.active:
            Shift.objects.filter(cashier=target, ended_at__isnull=True).update(ended_at=int(time.time() * 1000))
            # Cabut sesi kasir yang dinonaktifkan agar langsung keluar.
            Token.objects.filter(user=target.user).delete()
        return Response({'ok': True})

class CashierPasswordView(APIView):
    def post(self, request):
        actor = require_manager(request)
        if not actor: return error('Hanya manajer yang dapat mengatur ulang kata sandi.', 403)
        data = body(request)
        target = manager_cashiers(actor).filter(pk=as_id(data.get('id'))).select_related('user').first()
        password = str(data.get('password', ''))
        if not target: return error('Kasir tidak ditemukan.', 404)
        issue = password_error(password, target.user.first_name, target.user.email)
        if issue: return error(issue)
        target.user.set_password(password); target.user.save()
        Token.objects.filter(user=target.user).delete()
        return Response({'ok': True})

class ShiftView(APIView):
    def post(self, request):
        employee = employee_for(request.user)
        if not employee or employee.role != 'cashier' or not employee.active: return error('Hanya kasir aktif yang dapat mengelola shift.', 403)
        action = body(request).get('action'); now = int(time.time() * 1000)
        opened = Shift.objects.filter(cashier=employee, ended_at__isnull=True).first()
        if action == 'start':
            if opened and now - opened.started_at < 14 * 3600000: shift = opened
            else:
                if opened: opened.ended_at = opened.started_at + 14 * 3600000; opened.save(update_fields=['ended_at'])
                shift = Shift.objects.create(cashier=employee, started_at=now)
        elif action == 'end':
            if opened: opened.ended_at = now; opened.save(update_fields=['ended_at']); shift = opened
            else: return error('Tidak ada shift aktif.', 409)
        else: return error('Aksi shift tidak valid.')
        return Response(ShiftSerializer(shift).data)

def parse_lines(raw, manager):
    """Validasi baris pesanan dan ambil harga dari DB. Return (rows, error_message)."""
    if not isinstance(raw, list) or not raw: return None, 'Pesanan kosong.'
    if len(raw) > settings.POS_MAX_LINES: return None, 'Terlalu banyak baris pesanan.'
    quantities = {}
    for row in raw:
        if not isinstance(row, dict): return None, 'Baris pesanan tidak valid.'
        pid, qty = row.get('productId'), row.get('qty')
        if type(pid) is not int or type(qty) is not int or not (0 < pid < 2**62): return None, 'Baris pesanan tidak valid.'
        if qty < 1: return None, 'Jumlah menu minimal 1.'
        if qty > settings.POS_MAX_LINE_QTY: return None, f'Jumlah per menu maksimal {settings.POS_MAX_LINE_QTY}.'
        quantities[pid] = quantities.get(pid, 0) + qty
    if any(q > settings.POS_MAX_LINE_QTY for q in quantities.values()):
        return None, f'Jumlah per menu maksimal {settings.POS_MAX_LINE_QTY}.'
    products = {p.pk: p for p in Product.objects.filter(owner=manager, active=True, pk__in=list(quantities))}
    if len(products) != len(quantities): return None, 'Ada menu yang tidak tersedia atau sudah dinonaktifkan. Muat ulang halaman.'
    return [(products[pid], qty) for pid, qty in quantities.items()], None

def compute_discount(spec, subtotal):
    """Hitung diskon (rupiah bulat) dari spesifikasi {type, value}. Return (amount, error_message)."""
    if spec in (None, ''): return 0, None
    if not isinstance(spec, dict): return None, 'Diskon tidak valid.'
    kind, value = spec.get('type'), spec.get('value')
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value != value or value in (float('inf'), float('-inf')) or value <= 0:
        return None, 'Diskon tidak valid.'
    try:
        if kind == 'percent':
            if value > settings.POS_MAX_DISCOUNT_PERCENT: return None, f'Diskon maksimal {settings.POS_MAX_DISCOUNT_PERCENT:g}%.'
            amount = round_half_up(Decimal(subtotal) * Decimal(str(value)) / Decimal(100))
        elif kind == 'amount':
            amount = round_half_up(Decimal(str(min(value, subtotal))))
        else:
            return None, 'Jenis diskon tidak valid.'
    except InvalidOperation:
        return None, 'Diskon tidak valid.'
    return min(subtotal, amount), None

class TransactionView(APIView):
    def post(self, request):
        employee = employee_for(request.user)
        if not employee or employee.role != 'cashier' or not employee.active: return error('Hanya kasir aktif yang dapat memproses transaksi.', 403)
        shift = Shift.objects.filter(cashier=employee, ended_at__isnull=True).first()
        if not shift: return error('Aktifkan shift terlebih dahulu sebelum memproses pembayaran.', 409)
        manager = manager_of(employee)
        if not manager: return error('Kasir ini tidak terhubung ke manajer mana pun.', 403)
        data = body(request)

        rows, problem = parse_lines(data.get('lines'), manager)
        if problem: return error(problem)
        # Semua nominal dihitung di server dari harga menu di database; angka dari klien tidak dipakai.
        subtotal = sum(p.price * qty for p, qty in rows)
        items = sum(qty for _, qty in rows)
        if subtotal > MAX_ORDER_SUBTOTAL: return error('Total pesanan terlalu besar.')
        discount, problem = compute_discount(data.get('discount'), subtotal)
        if problem: return error(problem)
        tax = round_half_up(Decimal(subtotal - discount) * Decimal(str(settings.POS_TAX_RATE)))
        total = subtotal - discount + tax

        order_type = data.get('orderType', 'Makan di tempat')
        if order_type not in ORDER_TYPES: return error('Jenis pesanan tidak valid.')
        guest_count_raw = data.get('guestCount')
        if order_type == 'Makan di tempat':
            if guest_count_raw is None: return error('Jumlah tamu wajib dikirim untuk pesanan makan di tempat.')
            if type(guest_count_raw) is not int: return error('Jumlah tamu tidak valid.')
            if guest_count_raw < 1: return error('Jumlah tamu minimal 1.')
            if guest_count_raw > 999: return error('Jumlah tamu tidak valid.')
            guest_count = guest_count_raw
        else:
            guest_count = None

        with db_transaction.atomic():
            # Kunci baris manajer supaya dua kasir di restoran yang sama tidak mendapat nomor kembar.
            Employee.objects.select_for_update().get(pk=manager.pk)
            number = next_order_number(manager)
            tx = Transaction.objects.create(number=number, manager=manager, cashier=employee, shift=shift, at=int(time.time() * 1000), items=items, subtotal=subtotal, discount=discount, tax=tax, total=total, order_type=order_type, guest_count=guest_count)
            TransactionItem.objects.bulk_create([TransactionItem(transaction=tx, product=p, name=p.name, unit_price=p.price, quantity=qty) for p, qty in rows])
        return Response(TransactionSerializer(tx).data, status=201)


class HourlySalesView(APIView):
    """Omzet per jam untuk tanggal dan zona waktu lokal yang diminta manajer."""

    def get(self, request):
        employee = employee_for(request.user)
        if not employee or employee.role != 'manager' or not employee.active:
            return error('Laporan hanya dapat diakses oleh manajer aktif.', 403)

        zone_name = str(request.query_params.get('timezone', 'Asia/Jakarta')).strip()
        try:
            zone = ZoneInfo(zone_name)
        except (ZoneInfoNotFoundError, ValueError):
            return error('Zona waktu tidak valid.')

        raw_date = request.query_params.get('date')
        try:
            report_date = date.fromisoformat(raw_date) if raw_date else datetime.now(zone).date()
        except (TypeError, ValueError):
            return error('Tanggal laporan tidak valid.')

        start = datetime.combine(report_date, datetime_time.min, tzinfo=zone)
        end = start + timedelta(days=1)
        start_ms = int(start.timestamp() * 1000)
        end_ms = int(end.timestamp() * 1000)

        transactions = Transaction.objects.filter(
            Q(manager=employee) | Q(cashier__created_by=employee),
            at__gte=start_ms,
            at__lt=end_ms,
        ).values_list('at', 'total')

        slots = {hour: {'hour': hour, 'sales': 0, 'orders': 0} for hour in range(7, 24)}
        for timestamp, total in transactions.iterator():
            hour = datetime.fromtimestamp(timestamp / 1000, tz=zone).hour
            if hour in slots:
                slots[hour]['sales'] += total
                slots[hour]['orders'] += 1

        data = list(slots.values())
        return Response({
            'date': report_date.isoformat(),
            'timezone': zone_name,
            'startHour': 7,
            'endHour': 24,
            'totalSales': sum(slot['sales'] for slot in data),
            'totalOrders': sum(slot['orders'] for slot in data),
            'hours': data,
        })


class ProductCollectionView(APIView):
    def get(self, request):
        me = employee_for(request.user)
        if not me or not me.active: return error('Akun tidak aktif.', 403)
        return Response(ProductSerializer(menu_for(me).order_by('id'), many=True).data)
    def post(self, request):
        actor = require_manager(request)
        if not actor: return error('Hanya manajer yang dapat mengelola menu.', 403)
        serializer = ProductSerializer(data=body(request))
        if not serializer.is_valid(): return Response(serializer.errors, status=400)
        serializer.save(owner=actor); return Response(serializer.data, status=201)
    def patch(self, request):
        actor = require_manager(request)
        if not actor: return error('Hanya manajer yang dapat mengelola menu.', 403)
        data = body(request)
        product = Product.objects.filter(pk=as_id(data.get('id')), owner=actor).first()
        if not product: return error('Menu tidak ditemukan.', 404)
        changes = {k: data[k] for k in ('name', 'description', 'price', 'category', 'image', 'tag', 'active') if k in data}
        serializer = ProductSerializer(product, data=changes, partial=True)
        if not serializer.is_valid(): return Response(serializer.errors, status=400)
        serializer.save(); return Response(serializer.data)
    def delete(self, request):
        actor = require_manager(request)
        if not actor: return error('Hanya manajer yang dapat mengelola menu.', 403)
        product = Product.objects.filter(pk=as_id(body(request).get('id')), owner=actor).first()
        if not product: return error('Menu tidak ditemukan.', 404)
        product.delete(); return Response({'ok': True})
