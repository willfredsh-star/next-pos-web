"""Tes API NEXT POS. Jalankan: DJANGO_DEBUG=1 DB_ENGINE=sqlite python manage.py test"""
import re
import time
from datetime import datetime, timedelta, timezone as dt_timezone
from unittest import mock
from urllib.parse import unquote

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from .models import Employee, Transaction, TransactionItem
from .verification import make_token

PASSWORD = 'S3cure-pass!'


@override_settings(SECURE_SSL_REDIRECT=False, FRONTEND_BASE_URL='https://pos.test')
class ApiTestBase(APITestCase):
    def setUp(self):
        cache.clear()  # reset hitungan throttle antar tes

    def client_with(self, token=None):
        client = APIClient()
        if token:
            client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        return client

    def register_manager(self, email='a@example.com', name='Manajer A'):
        # Manajer baru harus verifikasi email dulu; tes meniru klik tautan lalu login.
        res = self.client_with().post('/api/auth/register-manager/', {'name': name, 'email': email, 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.data['verificationRequired'])
        self.verify(email)
        return self.login(email)

    def verify(self, email):
        user = User.objects.get(username=email)
        res = self.client_with().post('/api/auth/verify-email/', {'token': make_token(user)}, format='json')
        self.assertEqual(res.status_code, 200, res.content)

    def add_product(self, token, price=50000, **extra):
        payload = {'name': 'Nasi goreng', 'description': 'enak', 'price': price, 'category': 'Makanan berat', 'image': '', 'tag': '', 'active': True}
        payload.update(extra)
        res = self.client_with(token).post('/api/products/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.data['id']

    def add_cashier(self, manager_token, email='k@example.com'):
        res = self.client_with(manager_token).post('/api/cashiers/', {'name': 'Kasir Satu', 'email': email, 'password': PASSWORD, 'title': 'Kasir'}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.data['id']

    def login(self, email):
        res = self.client_with().post('/api/auth/login/', {'email': email, 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        return res.data['token']

    def cashier_on_shift(self, manager_token, email='k@example.com'):
        cashier_id = self.add_cashier(manager_token, email)
        token = self.login(email)
        res = self.client_with(token).post('/api/shifts/', {'action': 'start'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        return cashier_id, token

    def pay(self, token, lines, **extra):
        payload = {'lines': lines, 'orderType': 'Makan di tempat', 'guestCount': 2}
        payload.update(extra)
        return self.client_with(token).post('/api/transactions/', payload, format='json')


class AuthTests(ApiTestBase):
    def test_health(self):
        self.assertEqual(self.client_with().get('/api/health/').status_code, 200)

    def test_weak_passwords_rejected(self):
        for pw in ('12345678', 'password', 'short'):
            res = self.client_with().post('/api/auth/register-manager/', {'name': 'X Y', 'email': 'x@example.com', 'password': pw}, format='json')
            self.assertEqual(res.status_code, 400, pw)
            self.assertIn('error', res.data)

    @override_settings(ALLOW_REGISTRATION=False)
    def test_registration_can_be_closed(self):
        res = self.client_with().post('/api/auth/register-manager/', {'name': 'X Y', 'email': 'x@example.com', 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_login_is_throttled(self):
        last = None
        for _ in range(11):
            last = self.client_with().post('/api/auth/login/', {'email': 'nobody@example.com', 'password': 'salah-salah'}, format='json')
        self.assertEqual(last.status_code, 429)
        self.assertIn('error', last.data)

    def test_expired_token_is_rejected(self):
        token = self.register_manager()
        Token.objects.filter(key=token).update(created=timezone.now() - timedelta(days=400))
        res = self.client_with(token).get('/api/bootstrap/')
        self.assertEqual(res.status_code, 401)
        self.assertFalse(Token.objects.filter(key=token).exists())

    def test_login_replaces_expired_token(self):
        old = self.register_manager()
        Token.objects.filter(key=old).update(created=timezone.now() - timedelta(days=400))
        new = self.login('a@example.com')
        self.assertNotEqual(old, new)
        self.assertEqual(self.client_with(new).get('/api/bootstrap/').status_code, 200)

    def test_deactivating_cashier_revokes_session(self):
        manager = self.register_manager()
        cashier_id, cashier_token = self.cashier_on_shift(manager)
        res = self.client_with(manager).patch('/api/cashiers/', {'id': cashier_id, 'active': False}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client_with(cashier_token).get('/api/bootstrap/').status_code, 401)

    def test_password_reset_revokes_session(self):
        manager = self.register_manager()
        cashier_id, cashier_token = self.cashier_on_shift(manager)
        res = self.client_with(manager).post('/api/cashiers/password/', {'id': cashier_id, 'password': 'Another-pass-9'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client_with(cashier_token).get('/api/bootstrap/').status_code, 401)

    def test_cashier_cannot_manage_menu_or_staff(self):
        manager = self.register_manager()
        _, cashier_token = self.cashier_on_shift(manager)
        self.assertEqual(self.client_with(cashier_token).post('/api/products/', {'name': 'X', 'price': 1000, 'category': 'Minuman'}, format='json').status_code, 403)
        self.assertEqual(self.client_with(cashier_token).post('/api/cashiers/', {'name': 'Z Z', 'email': 'z@example.com', 'password': PASSWORD}, format='json').status_code, 403)


class EmailVerificationTests(ApiTestBase):
    def register(self, email='a@example.com'):
        return self.client_with().post('/api/auth/register-manager/', {'name': 'Manajer A', 'email': email, 'password': PASSWORD}, format='json')

    def login_raw(self, email='a@example.com'):
        return self.client_with().post('/api/auth/login/', {'email': email, 'password': PASSWORD}, format='json')

    def emailed_token(self):
        body = mail.outbox[-1].body
        match = re.search(r'https://pos\.test/\?verify=(\S+)', body)
        self.assertIsNotNone(match, body)
        return unquote(match.group(1))

    def test_register_sends_email_and_gives_no_session(self):
        res = self.register()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.data['verificationRequired'])
        self.assertTrue(res.data['emailSent'])
        self.assertNotIn('token', res.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['a@example.com'])
        self.assertFalse(Employee.objects.get(user__username='a@example.com').email_verified)

    def test_unverified_manager_cannot_login(self):
        self.register()
        res = self.login_raw()
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['code'], 'email_not_verified')

    def test_emailed_link_verifies_and_allows_login(self):
        self.register()
        res = self.client_with().post('/api/auth/verify-email/', {'token': self.emailed_token()}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(Employee.objects.get(user__username='a@example.com').email_verified)
        self.assertEqual(self.login_raw().status_code, 200)
        # Memakai tautan yang sama dua kali tidak merusak apa pun.
        self.assertEqual(self.client_with().post('/api/auth/verify-email/', {'token': self.emailed_token()}, format='json').status_code, 200)

    def test_bad_tokens_are_rejected(self):
        self.register()
        for token in ('', 'sampah', 'a' * 600, None, 123, {'x': 1}):
            res = self.client_with().post('/api/auth/verify-email/', {'token': token}, format='json')
            self.assertEqual(res.status_code, 400, token)
        self.assertFalse(Employee.objects.get(user__username='a@example.com').email_verified)

    def test_expired_token_is_rejected(self):
        self.register()
        user = User.objects.get(username='a@example.com')
        with mock.patch('time.time', return_value=time.time() - 3 * 86400):
            old = make_token(user)
        res = self.client_with().post('/api/auth/verify-email/', {'token': old}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Employee.objects.get(user=user).email_verified)

    def test_token_is_void_if_email_changed(self):
        self.register()
        user = User.objects.get(username='a@example.com')
        token = make_token(user)
        User.objects.filter(pk=user.pk).update(email='lain@example.com')
        self.assertEqual(self.client_with().post('/api/auth/verify-email/', {'token': token}, format='json').status_code, 400)

    def test_registering_unverified_email_again_points_to_resend(self):
        self.register()
        res = self.register()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'email_not_verified')

    def test_resend_only_emails_unverified_managers(self):
        self.register()
        mail.outbox.clear()
        post = lambda email: self.client_with().post('/api/auth/resend-verification/', {'email': email}, format='json')
        unknown = post('tidakada@example.com')
        known = post('a@example.com')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.data, known.data)  # jawaban sama: email terdaftar tidak bisa ditebak
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['a@example.com'])
        # Permintaan berikutnya dalam 1 menit tidak mengirim email lagi.
        post('a@example.com')
        self.assertEqual(len(mail.outbox), 1)
        # Setelah terverifikasi, tidak ada email lagi.
        self.verify('a@example.com')
        cache.clear()
        post('a@example.com')
        self.assertEqual(len(mail.outbox), 1)

    def test_cashiers_do_not_need_verification(self):
        manager = self.register_manager()
        self.add_cashier(manager, 'kasir@example.com')
        self.assertEqual(self.login_raw('kasir@example.com').status_code, 200)

    def test_register_still_succeeds_if_email_cannot_be_sent(self):
        with mock.patch('core.verification.send_mail', side_effect=OSError('smtp mati')):
            res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.data['emailSent'])
        # Manajer bisa minta kirim ulang saat SMTP pulih.
        mail.outbox.clear()
        self.client_with().post('/api/auth/resend-verification/', {'email': 'a@example.com'}, format='json')
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(REQUIRE_EMAIL_VERIFICATION=False)
    def test_verification_can_be_switched_off(self):
        res = self.register()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIn('token', res.data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(self.client_with(res.data['token']).get('/api/bootstrap/').status_code, 200)


class TransactionTests(ApiTestBase):
    def test_transaction_includes_ordered_lines(self):
        manager = self.register_manager()
        nasi = self.add_product(manager, price=50000, name='Nasi goreng')
        teh = self.add_product(manager, price=8000, name='Es teh', category='Minuman')
        _, cashier = self.cashier_on_shift(manager)
        res = self.pay(cashier, [{'productId': nasi, 'qty': 2}, {'productId': teh, 'qty': 1}])
        self.assertEqual(res.status_code, 201, res.content)
        self.assertCountEqual(res.data['lines'], [
            {'name': 'Nasi goreng', 'unitPrice': 50000, 'quantity': 2},
            {'name': 'Es teh', 'unitPrice': 8000, 'quantity': 1},
        ])

    def test_bootstrap_lines_keep_snapshot_after_menu_changes(self):
        manager = self.register_manager()
        nasi = self.add_product(manager, price=50000, name='Nasi goreng')
        _, cashier = self.cashier_on_shift(manager)
        self.assertEqual(self.pay(cashier, [{'productId': nasi, 'qty': 3}]).status_code, 201)
        # Menu diganti nama/harganya lalu dihapus: riwayat pesanan tidak ikut berubah.
        self.client_with(manager).patch('/api/products/', {'id': nasi, 'name': 'Mie goreng', 'price': 60000}, format='json')
        self.client_with(manager).delete('/api/products/', {'id': nasi}, format='json')
        for token in (manager, cashier):
            data = self.client_with(token).get('/api/bootstrap/').data
            self.assertEqual(data['transactions'][0]['lines'], [{'name': 'Nasi goreng', 'unitPrice': 50000, 'quantity': 3}])

    def test_server_computes_amounts_and_ignores_client_values(self):
        manager = self.register_manager()
        pid = self.add_product(manager, price=50000)
        _, cashier = self.cashier_on_shift(manager)
        res = self.pay(cashier, [{'productId': pid, 'qty': 2}], discount={'type': 'percent', 'value': 10}, subtotal=1, tax=0, total=1)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['subtotal'], 100000)
        self.assertEqual(res.data['discount'], 10000)
        self.assertEqual(res.data['tax'], 9900)
        self.assertEqual(res.data['total'], 99900)
        self.assertEqual(res.data['items'], 2)
        tx = Transaction.objects.get(pk=res.data['id'])
        line = TransactionItem.objects.get(transaction=tx)
        self.assertEqual((line.name, line.unit_price, line.quantity), ('Nasi goreng', 50000, 2))

    def test_amount_discount_is_capped_at_subtotal(self):
        manager = self.register_manager()
        pid = self.add_product(manager, price=10000)
        _, cashier = self.cashier_on_shift(manager)
        res = self.pay(cashier, [{'productId': pid, 'qty': 1}], discount={'type': 'amount', 'value': 999999999})
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['discount'], 10000)
        self.assertEqual(res.data['total'], 0)

    def test_order_numbers_are_sequential(self):
        manager = self.register_manager()
        pid = self.add_product(manager)
        _, cashier = self.cashier_on_shift(manager)
        numbers = [self.pay(cashier, [{'productId': pid, 'qty': 1}]).data['number'] for _ in range(2)]
        self.assertEqual(numbers, [1, 2])

    def test_rejects_invalid_orders(self):
        manager = self.register_manager()
        pid = self.add_product(manager)
        inactive = self.add_product(manager, active=False)
        other_manager = self.register_manager('b@example.com', 'Manajer B')
        foreign = self.add_product(other_manager)
        _, cashier = self.cashier_on_shift(manager)
        bad = [
            ([], {}),
            ([{'productId': pid, 'qty': 0}], {}),
            ([{'productId': pid, 'qty': 1.5}], {}),
            ([{'productId': pid, 'qty': True}], {}),
            ([{'productId': pid, 'qty': 100}], {}),
            ([{'productId': inactive, 'qty': 1}], {}),
            ([{'productId': foreign, 'qty': 1}], {}),
            ([{'productId': 999999, 'qty': 1}], {}),
            ([{'productId': pid, 'qty': 1}], {'discount': {'type': 'percent', 'value': 101}}),
            ([{'productId': pid, 'qty': 1}], {'discount': {'type': 'percent', 'value': -5}}),
            ([{'productId': pid, 'qty': 1}], {'discount': {'type': 'bogus', 'value': 5}}),
            ([{'productId': pid, 'qty': 1}], {'orderType': 'Antar'}),
            ([{'productId': pid, 'qty': 1}], {'guestCount': 0}),
        ]
        for lines, extra in bad:
            res = self.pay(cashier, lines, **extra)
            self.assertEqual(res.status_code, 400, (lines, extra, res.content))
        self.assertEqual(Transaction.objects.count(), 0)

    def test_takeaway_needs_no_guest_count(self):
        manager = self.register_manager()
        pid = self.add_product(manager)
        _, cashier = self.cashier_on_shift(manager)
        res = self.client_with(cashier).post('/api/transactions/', {'lines': [{'productId': pid, 'qty': 1}], 'orderType': 'Bawa pulang'}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(res.data['guestCount'])

    def test_requires_active_shift_and_cashier_role(self):
        manager = self.register_manager()
        pid = self.add_product(manager)
        cashier_id = self.add_cashier(manager)
        cashier = self.login('k@example.com')
        self.assertEqual(self.pay(cashier, [{'productId': pid, 'qty': 1}]).status_code, 409)
        self.assertEqual(self.pay(manager, [{'productId': pid, 'qty': 1}]).status_code, 403)

    def test_bootstrap_scopes_data_per_restaurant(self):
        manager_a = self.register_manager()
        pid_a = self.add_product(manager_a)
        _, cashier_a = self.cashier_on_shift(manager_a)
        self.pay(cashier_a, [{'productId': pid_a, 'qty': 1}])
        manager_b = self.register_manager('b@example.com', 'Manajer B')
        data_b = self.client_with(manager_b).get('/api/bootstrap/').data
        self.assertEqual(data_b['transactions'], [])
        self.assertEqual(data_b['products'], [])
        self.assertEqual(data_b['nextOrderNumber'], 1)
        data_a = self.client_with(manager_a).get('/api/bootstrap/').data
        self.assertEqual(len(data_a['transactions']), 1)
        self.assertEqual(data_a['taxRate'], 0.11)


class ProductTests(ApiTestBase):
    def test_invalid_product_data_returns_400_not_500(self):
        manager = self.register_manager()
        base = {'name': 'Es teh', 'description': '', 'price': 5000, 'category': 'Minuman', 'image': '', 'tag': '', 'active': True}
        for change in ({'price': -1}, {'price': 0}, {'price': 'abc'}, {'name': 'x' * 121}, {'category': 'Burger'}, {'image': 'javascript:alert(1)'}, {'image': 'data:image/png;base64,' + 'A' * 500000}):
            res = self.client_with(manager).post('/api/products/', {**base, **change}, format='json')
            self.assertEqual(res.status_code, 400, change)

    def test_patch_validates_and_other_manager_cannot_touch(self):
        manager = self.register_manager()
        pid = self.add_product(manager)
        res = self.client_with(manager).patch('/api/products/', {'id': pid, 'price': 'abc'}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client_with(manager).patch('/api/products/', {'id': pid, 'price': 60000, 'active': False}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual((res.data['price'], res.data['active']), (60000, False))
        other = self.register_manager('b@example.com', 'Manajer B')
        self.assertEqual(self.client_with(other).patch('/api/products/', {'id': pid, 'price': 1}, format='json').status_code, 404)
        self.assertEqual(self.client_with(other).delete('/api/products/', {'id': pid}, format='json').status_code, 404)
        self.assertEqual(self.client_with(manager).patch('/api/products/', {'id': 'bukan-angka'}, format='json').status_code, 404)


class HourlySalesReportTests(ApiTestBase):
    def test_manager_receives_hourly_sales_in_requested_timezone(self):
        manager_token = self.register_manager()
        product_id = self.add_product(manager_token, price=50000)
        _, cashier_token = self.cashier_on_shift(manager_token)

        # 01:30 UTC is 08:30 in Asia/Jakarta; 15:15 UTC is 22:15.
        first = int(datetime(2026, 11, 8, 1, 30, tzinfo=dt_timezone.utc).timestamp())
        second = int(datetime(2026, 11, 8, 15, 15, tzinfo=dt_timezone.utc).timestamp())
        with mock.patch('core.views.time.time', return_value=first):
            paid_morning = self.pay(cashier_token, [{'productId': product_id, 'qty': 1}])
        with mock.patch('core.views.time.time', return_value=second):
            paid_evening = self.pay(cashier_token, [{'productId': product_id, 'qty': 2}])
        self.assertEqual(paid_morning.status_code, 201, paid_morning.content)
        self.assertEqual(paid_evening.status_code, 201, paid_evening.content)

        response = self.client_with(manager_token).get(
            '/api/reports/hourly-sales/?date=2026-11-08&timezone=Asia%2FJakarta'
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['totalOrders'], 2)
        self.assertEqual(response.data['totalSales'], paid_morning.data['total'] + paid_evening.data['total'])
        self.assertEqual(len(response.data['hours']), 17)
        self.assertEqual(response.data['hours'][1]['hour'], 8)
        self.assertEqual(response.data['hours'][1]['orders'], 1)
        self.assertEqual(response.data['hours'][15]['hour'], 22)
        self.assertEqual(response.data['hours'][15]['orders'], 1)

    def test_hourly_sales_report_is_manager_only(self):
        manager_token = self.register_manager()
        _, cashier_token = self.cashier_on_shift(manager_token)
        response = self.client_with(cashier_token).get('/api/reports/hourly-sales/')
        self.assertEqual(response.status_code, 403)

    def test_invalid_report_timezone_is_rejected(self):
        manager_token = self.register_manager()
        response = self.client_with(manager_token).get(
            '/api/reports/hourly-sales/?timezone=Not%2FAZone'
        )
        self.assertEqual(response.status_code, 400)
