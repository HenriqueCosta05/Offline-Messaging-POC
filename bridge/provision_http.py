"""HTTP endpoints the mobile app calls to provision its Matrix account."""
import hmac
import logging
from dataclasses import asdict

from aiohttp import web

from .provisioning import ProvisionError, ProvisioningService

log = logging.getLogger("bridge")
STATUS = {
    "unauthorized": 401, "bad_request": 400, "invalid_phone": 422, "invalid_username": 422,
    "username_taken": 409, "phone_taken": 409, "registration_rejected": 502, "homeserver_unavailable": 503,
}


def error_response(err: ProvisionError) -> web.Response:
    body = {"code": err.code, "message": err.message}
    if err.user_id:
        body["user_id"] = err.user_id
    return web.json_response(body, status=STATUS.get(err.code, 500))


def auth_middleware(token: str):
    expected = f"Bearer {token}".encode()

    @web.middleware
    async def check(request: web.Request, handler):
        given = request.headers.get("Authorization", "").encode()
        if not hmac.compare_digest(given, expected):
            return error_response(ProvisionError("unauthorized", "missing or wrong token"))
        return await handler(request)

    return check


@web.middleware
async def error_middleware(request: web.Request, handler):
    try:
        return await handler(request)
    except ProvisionError as err:
        if STATUS.get(err.code, 500) >= 500:
            log.warning("provisioning failed: %s (%s)", err.code, err.message)
        return error_response(err)


async def read_fields(request: web.Request, *names: str) -> list[str]:
    try:
        body = await request.json()
    except ValueError as exc:
        raise ProvisionError("bad_request", "body must be JSON") from exc
    if not isinstance(body, dict) or not all(isinstance(body.get(name), str) for name in names):
        raise ProvisionError("bad_request", f"expected string fields: {', '.join(names)}")
    return [body[name] for name in names]


class Handlers:
    def __init__(self, service: ProvisioningService):
        self._service = service

    async def lookup(self, request: web.Request) -> web.Response:
        (phone,) = await read_fields(request, "phone")
        return web.json_response({"user_id": self._service.lookup(phone)})

    async def provision(self, request: web.Request) -> web.Response:
        phone, username = await read_fields(request, "phone", "username")
        return web.json_response(asdict(await self._service.provision(phone, username)))


def create_app(service: ProvisioningService, token: str) -> web.Application:
    app = web.Application(middlewares=[auth_middleware(token), error_middleware])
    handlers = Handlers(service)
    app.router.add_post("/lookup", handlers.lookup)
    app.router.add_post("/provision", handlers.provision)
    return app
