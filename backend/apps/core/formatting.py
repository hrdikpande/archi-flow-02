"""Display formats for emails and exports (N-08, DESIGN.md §7)."""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any


def inr(amount: Any) -> str:
    """₹ with Indian digit grouping: 3840000 → ₹38,40,000; paise only when present."""
    if amount is None or amount == "":
        return ""
    value = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sign = "-" if value < 0 else ""
    whole, _, paise = f"{abs(value):.2f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups: list[str] = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join([*groups, tail])
    return f"{sign}₹{whole}" + (f".{paise}" if paise != "00" else "")
