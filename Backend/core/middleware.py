from ipaddress import ip_address
from urllib.parse import urlsplit


class InternalHealthProbeHostMiddleware:
    """Normalize private-IP and Kubernetes service Host headers for health probes only."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/api/health/":
            raw_host = request.META.get("HTTP_HOST", "")
            try:
                host = urlsplit("//" + raw_host).hostname
                address = ip_address(host) if host else None
            except ValueError:
                host = None
                address = None

            is_private_ip = address is not None and address.is_private
            is_kubernetes_service = (
                host is not None
                and host.lower().endswith(".svc.cluster.local")
            )

            if is_private_ip or is_kubernetes_service:
                # localhost is explicitly included in ALLOWED_HOSTS.
                request.META["HTTP_HOST"] = "localhost"

        return self.get_response(request)
