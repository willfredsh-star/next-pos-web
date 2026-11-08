
from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    HealthView,
    RegisterManagerView,
    LoginView,
    LogoutView,
    VerifyEmailView,
    ResendVerificationView,
    BootstrapView,
    ProfileView,
    CashierCollectionView,
    CashierPasswordView,
    ShiftView,
    TransactionView,
    HourlySalesView,
    ProductCollectionView,
)

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('auth/register-manager/', RegisterManagerView.as_view()),
    path('auth/login/', LoginView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
    path('auth/verify-email/', VerifyEmailView.as_view()),
    path('auth/resend-verification/', ResendVerificationView.as_view()),
    path('auth/me/', BootstrapView.as_view()),
    path('bootstrap/', BootstrapView.as_view()),
    path('profile/', ProfileView.as_view()),
    path('cashiers/', CashierCollectionView.as_view()),
    path('cashiers/password/', CashierPasswordView.as_view()),
    path('shifts/', ShiftView.as_view()),
    path('transactions/', TransactionView.as_view()),
    path('reports/hourly-sales/', HourlySalesView.as_view()),
    path('products/', ProductCollectionView.as_view()),
]
