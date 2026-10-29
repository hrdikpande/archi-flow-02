"""Templated email (I-12). Sending happens on the `email` queue after the transaction commits.

Outside production, mail may only go to a local catcher (CLAUDE.md, BUILD_PROMPT rule 7).
"""

from typing import Any

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string

SMTP_BACKENDS = {"django.core.mail.backends.smtp.EmailBackend"}


def email_target_problem() -> str | None:
    """Returns why the current configuration could send real email outside production."""
    if settings.ENVIRONMENT == "production":
        return None
    if settings.EMAIL_BACKEND in SMTP_BACKENDS and (
        settings.EMAIL_HOST not in settings.NON_PRODUCTION_EMAIL_HOSTS
    ):
        return (
            f"{settings.ENVIRONMENT} must not send real email: EMAIL_HOST={settings.EMAIL_HOST!r} "
            f"is not a local catcher ({', '.join(sorted(settings.NON_PRODUCTION_EMAIL_HOSTS))})."
        )
    return None


def render_email(template: str, context: dict[str, Any]) -> tuple[str, str, str]:
    ctx = {"frontend_url": settings.FRONTEND_URL, **context}
    subject = render_to_string(f"email/{template}.subject.txt", ctx).strip().splitlines()[0]
    text = render_to_string(f"email/{template}.txt", ctx)
    html = render_to_string(f"email/{template}.html", ctx)
    return subject, text, html


def deliver(to: list[str], template: str, context: dict[str, Any]) -> None:
    problem = email_target_problem()
    if problem:
        raise ImproperlyConfigured(problem)
    subject, text, html = render_email(template, context)
    message = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, to)
    message.attach_alternative(html, "text/html")
    message.send()


def send_templated_email(to: list[str], template: str, context: dict[str, Any]) -> None:
    """Queue an email once the current transaction commits."""
    from .tasks import send_email

    recipients = [addr for addr in to if addr]
    if recipients:
        transaction.on_commit(lambda: send_email.delay(recipients, template, context))
