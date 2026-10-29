"""Narrow `request.user` to a signed-in organisation member for views (typing and safety)."""

from django.http import HttpRequest
from rest_framework.exceptions import NotAuthenticated
from rest_framework.request import Request

from .models import User


def acting_user(request: Request | HttpRequest) -> User:
    user = request.user
    if not isinstance(user, User) or user.organisation_id is None:
        raise NotAuthenticated()
    return user
