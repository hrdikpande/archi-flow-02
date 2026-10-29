"""Per-request context (request ID, actor, IP) used by logs and audit rows."""

from contextvars import ContextVar
from dataclasses import dataclass


@dataclass(frozen=True)
class RequestContext:
    request_id: str = ""
    ip: str | None = None
    user_id: str | None = None


# RequestContext is a frozen dataclass, so a shared default instance is safe.
_current: ContextVar[RequestContext] = ContextVar(
    "request_context",
    default=RequestContext(),  # noqa: B039
)


def get_context() -> RequestContext:
    return _current.get()


def set_context(ctx: RequestContext) -> object:
    return _current.set(ctx)


def reset_context(token: object) -> None:
    _current.reset(token)  # type: ignore[arg-type]
