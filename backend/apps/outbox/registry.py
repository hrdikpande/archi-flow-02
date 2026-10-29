"""Event name → handlers. Handlers must be idempotent and quick; heavy work goes to a queue."""

from collections import defaultdict
from collections.abc import Callable

from .models import OutboxEvent

Handler = Callable[[OutboxEvent], None]

_handlers: dict[str, list[Handler]] = defaultdict(list)


def handler_name(fn: Handler) -> str:
    return f"{fn.__module__}.{fn.__qualname__}"


def handles(event_name: str) -> Callable[[Handler], Handler]:
    def decorator(fn: Handler) -> Handler:
        if handler_name(fn) not in {handler_name(h) for h in _handlers[event_name]}:
            _handlers[event_name].append(fn)
        return fn

    return decorator


def handlers_for(event_name: str) -> list[Handler]:
    return list(_handlers.get(event_name, []))


def unregister(event_name: str, fn: Handler) -> None:
    _handlers[event_name] = [
        h for h in _handlers[event_name] if handler_name(h) != handler_name(fn)
    ]
