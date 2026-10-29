"""Sheet-number and file-name rules (F-35, A-04). Rules are regex, per org, overridable per
project: when a project has active rules for a target, they replace the org's rules."""

import re
from pathlib import PurePath

from apps.core.models import Discipline
from apps.projects.models import Project

from .models import NamingRule, NamingTarget


def rules_for(project: Project, target: str) -> list[NamingRule]:
    rules = NamingRule.objects.filter(
        organisation_id=project.organisation_id, target=target, is_active=True
    )
    project_rules = [r for r in rules if r.project_id == project.pk]
    return project_rules or [r for r in rules if r.project_id is None]


def _rule_text(rule: NamingRule) -> str:
    return rule.message or f"Use the format `{rule.regex}`, for example {rule.example}."


def sheet_number_problems(project: Project, discipline: Discipline, number: str) -> list[str]:
    problems = []
    if discipline.sheet_prefix_regex and not re.search(discipline.sheet_prefix_regex, number):
        problems.append(
            f"Sheet number {number} doesn't match the {discipline.name} rule "
            f"`{discipline.sheet_prefix_regex}`."
        )
    for rule in rules_for(project, NamingTarget.SHEET_NUMBER):
        if not re.search(rule.regex, number):
            problems.append(f"Sheet number {number} doesn't match the rule: {_rule_text(rule)}")
    return problems


def contains_sheet_number(file_name: str, number: str) -> bool:
    stem = PurePath(file_name).stem
    return re.search(rf"(?<![A-Za-z0-9]){re.escape(number)}(?![A-Za-z0-9])", stem, re.I) is not None


def file_name_problems(project: Project, number: str, file_name: str) -> list[str]:
    """A-04: the file name must carry the sheet number and follow the file-name rules.
    Messages say what to do (DESIGN.md §7)."""
    problems = []
    suffix = PurePath(file_name).suffix or ".pdf"
    if not contains_sheet_number(file_name, number):
        problems.append(
            f"File name {file_name} doesn't contain the sheet number {number}. "
            f"Rename to {number}{suffix}."
        )
    for rule in rules_for(project, NamingTarget.FILE_NAME):
        if not re.search(rule.regex, file_name):
            problems.append(
                f"File name {file_name} doesn't match rule `{rule.regex}`. "
                f"{rule.message or f'Rename to {rule.example}.'}"
            )
    return problems


def test_value(project: Project | None, target: str, value: str, organisation_id) -> list[str]:
    """Live tester in admin settings (S-14 'paste a file name, see pass/fail')."""
    rules = NamingRule.objects.filter(
        organisation_id=organisation_id, target=target, is_active=True
    )
    if project is not None:
        scoped = [r for r in rules if r.project_id == project.pk]
        rules = scoped or [r for r in rules if r.project_id is None]  # type: ignore[assignment]
    else:
        rules = [r for r in rules if r.project_id is None]  # type: ignore[assignment]
    return [
        f"Doesn't match `{r.regex}`: {_rule_text(r)}"
        for r in rules
        if not re.search(r.regex, value)
    ]
