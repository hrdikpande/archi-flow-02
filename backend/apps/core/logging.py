import logging

from .context import get_context


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        ctx = get_context()
        record.request_id = ctx.request_id
        record.user_id = ctx.user_id or ""
        return True
