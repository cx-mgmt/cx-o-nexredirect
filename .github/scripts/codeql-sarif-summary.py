#!/usr/bin/env python3
"""Wertet CodeQL-SARIF aus, schreibt Funde ins Job-Summary und bricht bei
blockierenden Funden ab.

Blockierend ist ein Fund mit SARIF-Schwere error oder security-severity >= 7.
Alle Funde werden gemeldet. Nichts wird verworfen.
"""

import json
import os
import sys
from pathlib import Path
from urllib.parse import unquote


def main() -> int:
    sarif_dir = Path(os.environ.get("SARIF_DIR") or "").expanduser()
    language = os.environ.get("CODEQL_LANGUAGE") or sarif_dir.name or "codeql"
    files = sorted(sarif_dir.glob("*.sarif")) if sarif_dir.is_dir() else []
    if not files:
        message = f"Keine SARIF-Datei in {sarif_dir}."
        print(message, file=sys.stderr)
        _write_summary(f"### CodeQL ({language})\n\n{message}\n")
        print(f"::error::{message}")
        return 1

    findings = []
    for path in files:
        findings.extend(_findings_from_file(path))

    blocking = [item for item in findings if item["blocking"]]
    summary = _render(language, findings, blocking)
    _write_summary(summary)
    print(summary)

    for item in findings:
        _annotate(item)

    if blocking:
        message = (
            f"CodeQL ({language}): {len(blocking)} blockierende Funde "
            "(Schwere error oder security-severity ab 7)."
        )
        print(message, file=sys.stderr)
        return 1
    return 0


def _findings_from_file(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"SARIF ist kein JSON: {path}: {exc}") from exc

    findings = []
    for run in data.get("runs") or []:
        rules = _rules(run)
        for result in run.get("results") or []:
            findings.append(_finding(result, rules))
    return findings


def _rules(run: dict) -> dict:
    tool = run.get("tool") or {}
    driver = tool.get("driver") or {}
    ordered = list(driver.get("rules") or [])
    by_id = {}
    for rule in ordered:
        rule_id = rule.get("id")
        if rule_id:
            by_id[rule_id] = rule
    for extension in tool.get("extensions") or []:
        for rule in extension.get("rules") or []:
            rule_id = rule.get("id")
            if rule_id and rule_id not in by_id:
                by_id[rule_id] = rule
    return {"ordered": ordered, "by_id": by_id}


def _finding(result: dict, rules: dict) -> dict:
    rule = _rule_for(result, rules)
    level = result.get("level")
    if not level and rule:
        level = (rule.get("defaultConfiguration") or {}).get("level")
    if not level:
        level = "warning"

    severity = _security_severity(result, rule)
    uri, line = _location(result)
    rule_id = result.get("ruleId") or (rule or {}).get("id") or ""
    name = ""
    if rule:
        name = ((rule.get("shortDescription") or {}).get("text")) or (
            (rule.get("properties") or {}).get("name")
        ) or ""
    message = _message(result)

    return {
        "level": str(level),
        "severity": severity,
        "blocking": str(level) == "error" or (severity is not None and severity >= 7),
        "rule_id": rule_id,
        "name": name,
        "uri": uri,
        "line": line,
        "message": message,
    }


def _rule_for(result: dict, rules: dict) -> dict | None:
    ordered = rules["ordered"]
    index = result.get("ruleIndex")
    if not isinstance(index, int):
        nested = result.get("rule") or {}
        index = nested.get("index")
    if isinstance(index, int) and 0 <= index < len(ordered):
        return ordered[index]
    rule_id = result.get("ruleId") or (result.get("rule") or {}).get("id")
    if rule_id:
        return rules["by_id"].get(rule_id)
    return None


def _security_severity(result: dict, rule: dict | None) -> float | None:
    sources = [result.get("properties") or {}]
    if rule:
        sources.append(rule.get("properties") or {})
    for props in sources:
        if "security-severity" not in props:
            continue
        raw = props.get("security-severity")
        try:
            return float(raw)
        except (TypeError, ValueError):
            return None
    return None


def _location(result: dict) -> tuple[str, int | None]:
    locations = result.get("locations") or []
    if not locations:
        return "", None
    physical = locations[0].get("physicalLocation") or {}
    artifact = physical.get("artifactLocation") or {}
    uri = unquote(artifact.get("uri") or "")
    line = (physical.get("region") or {}).get("startLine")
    if not isinstance(line, int):
        line = None
    return uri, line


def _message(result: dict) -> str:
    message = result.get("message") or {}
    text = message.get("text") or message.get("markdown") or ""
    text = " ".join(str(text).split())
    if len(text) > 240:
        text = text[:237] + "..."
    return text


def _render(language: str, findings: list[dict], blocking: list[dict]) -> str:
    lines = [f"### CodeQL ({language})", ""]
    if not findings:
        lines.append("Keine Funde.")
        lines.append("")
        return "\n".join(lines)

    lines.append(
        f"{_count(len(findings), 'Fund', 'Funde')}, davon "
        f"{len(blocking)} blockierend (Schwere error oder security-severity ab 7)."
    )
    lines.append("")
    lines.append("| Schwere | Security-Severity | Blockierend | Regel | Ort | Meldung |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    ordered = sorted(
        findings,
        key=lambda item: (
            not item["blocking"],
            -(item["severity"] if item["severity"] is not None else -1),
            item["uri"],
            item["line"] or 0,
            item["rule_id"],
        ),
    )
    for item in ordered:
        severity = "" if item["severity"] is None else f"{item['severity']:g}"
        rule = item["rule_id"] or item["name"]
        place = item["uri"]
        if item["line"]:
            place = f"{place}:{item['line']}" if place else str(item["line"])
        lines.append(
            "| {level} | {severity} | {blocking} | {rule} | {place} | {message} |".format(
                level=_cell(item["level"]),
                severity=_cell(severity),
                blocking="ja" if item["blocking"] else "nein",
                rule=_cell(rule),
                place=_cell(place),
                message=_cell(item["message"]),
            )
        )
    lines.append("")
    return "\n".join(lines)


def _count(number: int, singular: str, plural: str) -> str:
    word = singular if number == 1 else plural
    return f"{number} {word}"


def _cell(value: str) -> str:
    text = str(value).replace("|", "\\|").replace("<", "&lt;")
    return text


def _annotate(item: dict) -> None:
    kind = "error" if item["blocking"] else "warning"
    place = item["uri"] or "."
    line = f",line={item['line']}" if item["line"] else ""
    title = item["rule_id"] or "CodeQL"
    severity = "" if item["severity"] is None else f", security-severity {item['severity']:g}"
    message = _command_text(f"{item['level']}{severity}: {item['message']}")
    print(f"::{kind} file={place}{line},title={_command_text(title)}::{message}")


def _command_text(value: str) -> str:
    return (
        str(value)
        .replace("%", "%25")
        .replace("\r", "%0D")
        .replace("\n", "%0A")
        .replace(",", "%2C")
        .replace(":", "%3A")
    )


def _write_summary(markdown: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(markdown)
        if not markdown.endswith("\n"):
            handle.write("\n")


if __name__ == "__main__":
    sys.exit(main())
