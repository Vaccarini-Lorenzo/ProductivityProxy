from __future__ import annotations

import re
from typing import Any, Callable

Issue = dict[str, Any]
IssueFactory = Callable[[str, str], Issue]
_TIME = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def validate_modes(modes: list[Any], issue: IssueFactory) -> list[Issue]:
    issues: list[Issue] = []
    ranges: list[tuple[str, list[tuple[int, int]]]] = []
    for mode in modes:
        if not isinstance(mode, dict):
            continue
        name = str(mode.get("name", mode.get("id", "mode")))
        friction = mode.get("createFriction", False)
        if not isinstance(friction, bool):
            issues.append(issue(
                f"Mode '{name}' create friction flag must be true or false.",
                "Toggle Create friction off and on again.",
            ))

        default_time = mode.get("defaultTime")
        if default_time is None:
            continue
        if not isinstance(default_time, dict):
            issues.append(issue(
                f"Mode '{name}' default time must be an object.",
                "Disable and re-enable its default time.",
            ))
            continue
        start = default_time.get("start")
        end = default_time.get("end")
        if not _valid_time(start) or not _valid_time(end):
            issues.append(issue(
                f"Mode '{name}' has an invalid default time.",
                "Choose both a start and end time using HH:MM.",
            ))
            continue
        start_minutes = _minutes(start)
        end_minutes = _minutes(end)
        if start_minutes == end_minutes:
            issues.append(issue(
                f"Mode '{name}' default start and end times must differ.",
                "Choose a shorter daily interval.",
            ))
            continue
        ranges.append((name, _segments(start_minutes, end_minutes)))

    issues.extend(_overlap_issues(ranges, issue))
    return issues


def _valid_time(value: Any) -> bool:
    return isinstance(value, str) and _TIME.fullmatch(value) is not None


def _minutes(value: str) -> int:
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


def _segments(start: int, end: int) -> list[tuple[int, int]]:
    if start < end:
        return [(start, end)]
    return [(start, 24 * 60), (0, end)]


def _overlap_issues(
    ranges: list[tuple[str, list[tuple[int, int]]]], issue: IssueFactory
) -> list[Issue]:
    issues: list[Issue] = []
    for index, (left_name, left) in enumerate(ranges):
        for right_name, right in ranges[index + 1:]:
            if any(a < d and c < b for a, b in left for c, d in right):
                issues.append(issue(
                    f"Default times overlap for '{left_name}' and '{right_name}'.",
                    "Choose daily intervals that do not overlap.",
                ))
    return issues
