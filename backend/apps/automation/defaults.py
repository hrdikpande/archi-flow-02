"""Default thresholds (03 §10). Placeholders to agree with the owner; editable in Admin."""

DEFAULT_RULES: dict[str, dict] = {
    "A-01": {"at_risk_working_days": 7, "states": ["planned", "in_progress"]},
    "A-02": {"escalate_after_working_days": 3},
    "A-05": {"over_allocated_pct": 110, "under_allocated_pct": 50},
    "A-06": {"due_weekday": 1, "due_time": "12:00"},
    "A-07": {"review_open_working_days": 3},
    "A-08": {"comment_unanswered_days": 5},
    "A-10": {"rfi_due_working_days": 2},
}

# When each scheduled rule runs, in organisation local time (03 §10).
SCHEDULES: dict[str, dict] = {
    "A-01": {"daily": "08:00"},
    "A-02": {"daily": "08:00"},
    "A-05": {"weekly": (0, "07:00")},  # Monday
    "A-06": {"weekly": (1, "12:00")},  # Tuesday
    "A-07": {"daily": "08:00"},
    "A-08": {"daily": "08:00"},
    "A-10": {"daily": "08:00"},
}
# A missing daily run by this time raises an alert (02 §8, N-05).
MISSING_RUN_ALERT_AT = "09:00"
