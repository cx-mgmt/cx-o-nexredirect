#!/usr/bin/env python3
"""Wertet CodeQL-SARIF aus, schreibt Funde ins Job-Summary und bricht bei
blockierenden Funden ab.

Blockierend ist ein Fund mit SARIF-Schwere error oder security-severity >= 7.
Passende, nicht abgelaufene Einträge aus .github/codeql-ausnahmen.json gelten
als akzeptiert: sie bleiben sichtbar, machen den Job aber nicht rot.
Abgelaufene Ausnahmen lassen den Fund wieder blockieren. Einträge ohne
passenden Fund in einer vollen Analyse werden als Warnung gemeldet.
"""

import json
import os
import sys
from datetime import date
from pathlib import Path
from urllib.parse import unquote


def main() -> int:
    root = Path(os.environ.get("GITHUB_WORKSPACE") or os.getcwd())
    sarif_dir = Path(os.environ.get("SARIF_DIR") or "").expanduser()
    language = os.environ.get("CODEQL_LANGUAGE") or sarif_dir.name or "codeql"
    files = sorted(sarif_dir.glob("*.sarif")) if sarif_dir.is_dir() else []
    if not files:
        message = f"Keine SARIF-Datei in {sarif_dir}."
        print(message, file=sys.stderr)
        _write_summary(f"### CodeQL ({language})\n\n{message}\n")
        print(f"::error::{message}")
        return 1

    documents = [_load_sarif(path) for path in files]
    findings = []
    for document in documents:
        for run in document.get("runs") or []:
            rules = _rules(run)
            for result in run.get("results") or []:
                findings.append(_finding(result, rules))

    exceptions = _load_exceptions(root)
    today = _today()
    accepted = []
    warnings = []
    for entry in exceptions:
        entry["used"] = False
        entry["expired_hit"] = False

    for finding in findings:
        match = _first_match(exceptions, finding, root, today, accept_expired=False)
        if match is not None:
            match["used"] = True
            finding["blocking"] = False
            finding["accepted"] = True
            finding["begruendung"] = match["begruendung"]
            finding["pruefen_bis"] = match["pruefen_bis"].isoformat()
            accepted.append(finding)
            continue
        expired = _first_match(exceptions, finding, root, today, accept_expired=True)
        if expired is not None and today > expired["pruefen_bis"]:
            finding["expired"] = True
            if not expired["expired_hit"]:
                warnings.append(
                    "Ausnahme abgelaufen am "
                    f"{expired['pruefen_bis'].isoformat()}: {expired['regel']} in {expired['pfad']}. "
                    "Der Fund blockiert wieder."
                )
            expired["expired_hit"] = True

    for entry in exceptions:
        if entry["used"] or entry["expired_hit"]:
            continue
        if not _exception_in_scope(entry, documents):
            continue
        if today > entry["pruefen_bis"]:
            warnings.append(
                "Ausnahme abgelaufen und ohne passenden Fund: "
                f"{entry['regel']} in {entry['pfad']} (pruefenBis {entry['pruefen_bis'].isoformat()})."
            )
        else:
            warnings.append(
                "Ausnahme ohne passenden Fund: "
                f"{entry['regel']} in {entry['pfad']}. Eintrag prüfen, vermutlich veraltet."
            )

    open_findings = [item for item in findings if not item.get("accepted")]
    blocking = [item for item in open_findings if item["blocking"]]
    summary = _render(language, open_findings, accepted, blocking, warnings)
    _write_summary(summary)
    print(summary)

    for item in open_findings:
        _annotate(item)
    for item in accepted:
        _notice_accepted(item)
    for warning in warnings:
        print(f"::warning::{_command_text(warning)}")

    if blocking:
        message = (
            f"CodeQL ({language}): {len(blocking)} blockierende Funde "
            "(Schwere error oder security-severity ab 7)."
        )
        print(message, file=sys.stderr)
        return 1
    return 0


def _load_sarif(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"SARIF ist kein JSON: {path}: {exc}") from exc


def _load_exceptions(root: Path) -> list[dict]:
    configured = os.environ.get("CODEQL_AUSNAHMEN")
    path = Path(configured) if configured else root / ".github" / "codeql-ausnahmen.json"
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Ausnahmedatei ist kein JSON: {path}: {exc}") from exc
    entries = data.get("ausnahmen") if isinstance(data, dict) else None
    if not isinstance(entries, list):
        raise SystemExit(f"Ausnahmedatei braucht eine Liste 'ausnahmen': {path}")
    loaded = []
    for index, raw in enumerate(entries, start=1):
        loaded.append(_parse_exception(raw, index, path))
    return loaded


def _parse_exception(raw: object, index: int, path: Path) -> dict:
    if not isinstance(raw, dict):
        raise SystemExit(f"Ausnahme {index} in {path} ist kein Objekt.")
    regel = raw.get("regel")
    pfad = raw.get("pfad")
    begruendung = raw.get("begruendung")
    until = raw.get("pruefenBis")
    if not all(isinstance(value, str) and value.strip() for value in (regel, pfad, begruendung, until)):
        raise SystemExit(
            f"Ausnahme {index} in {path} braucht regel, pfad, begruendung und pruefenBis."
        )
    try:
        until_date = date.fromisoformat(until)
    except ValueError as exc:
        raise SystemExit(f"Ausnahme {index} in {path}: pruefenBis ist kein Datum YYYY-MM-DD.") from exc
    zeile = raw.get("zeile")
    snippet = raw.get("snippet")
    if zeile is not None and (not isinstance(zeile, int) or isinstance(zeile, bool) or zeile < 1):
        raise SystemExit(f"Ausnahme {index} in {path}: zeile muss eine positive Zahl sein.")
    if snippet is not None and (not isinstance(snippet, str) or not snippet.strip()):
        raise SystemExit(f"Ausnahme {index} in {path}: snippet muss Text sein.")
    if zeile is None and not snippet:
        raise SystemExit(
            f"Ausnahme {index} in {path} braucht zeile oder snippet, sonst wäre der ganze Pfad akzeptiert."
        )
    return {
        "regel": regel.strip(),
        "pfad": _norm_path(pfad),
        "begruendung": " ".join(begruendung.split()),
        "pruefen_bis": until_date,
        "zeile": zeile,
        "snippet": snippet.strip() if isinstance(snippet, str) else None,
    }


def _today() -> date:
    override = os.environ.get("CODEQL_HEUTE")
    if override:
        return date.fromisoformat(override)
    return date.today()


def _first_match(
    exceptions: list[dict],
    finding: dict,
    root: Path,
    today: date,
    accept_expired: bool,
) -> dict | None:
    for entry in exceptions:
        expired = today > entry["pruefen_bis"]
        if expired and not accept_expired:
            continue
        if not expired and accept_expired:
            continue
        if _locator_matches(entry, finding, root):
            return entry
    return None


def _locator_matches(entry: dict, finding: dict, root: Path) -> bool:
    if entry["regel"] != finding["rule_id"]:
        return False
    if entry["pfad"] != _norm_path(finding["uri"]):
        return False
    if entry["snippet"]:
        return _line_contains(root, finding["uri"], finding["line"], finding.get("end_line"), entry["snippet"])
    return finding["line"] == entry["zeile"]


def _line_contains(root: Path, uri: str, line: int | None, end_line: int | None, snippet: str) -> bool:
    if not line:
        return False
    text = _source_lines(root, uri)
    if text is None:
        return False
    start = line
    end = end_line if isinstance(end_line, int) and end_line >= line else line
    chunk = "\n".join(text[start - 1 : end])
    return snippet in chunk


def _source_lines(root: Path, uri: str) -> list[str] | None:
    cache = getattr(_source_lines, "cache", None)
    if cache is None:
        cache = {}
        setattr(_source_lines, "cache", cache)
    key = _norm_path(uri)
    if key not in cache:
        path = root / key
        if not path.is_file():
            cache[key] = None
        else:
            cache[key] = path.read_text(encoding="utf-8").splitlines()
    return cache[key]


def _exception_in_scope(entry: dict, documents: list[dict]) -> bool:
    """Volle Analyse, die diese Regel und den Pfad wirklich gesehen hat."""
    for document in documents:
        for run in document.get("runs") or []:
            if (run.get("properties") or {}).get("incrementalMode") == "diff-informed":
                continue
            rules = _rules(run)["by_id"]
            if entry["regel"] not in rules:
                continue
            artifacts = _artifact_paths(run)
            if artifacts and entry["pfad"] not in artifacts:
                continue
            return True
    return False


def _artifact_paths(run: dict) -> set[str]:
    paths = set()
    for artifact in run.get("artifacts") or []:
        uri = ((artifact.get("location") or {}).get("uri")) or ""
        if uri:
            paths.add(_norm_path(unquote(uri)))
    return paths


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
    uri, line, end_line = _location(result)
    rule_id = result.get("ruleId") or (rule or {}).get("id") or ""
    name = ""
    if rule:
        name = ((rule.get("shortDescription") or {}).get("text")) or (
            (rule.get("properties") or {}).get("name")
        ) or ""
    return {
        "level": str(level),
        "severity": severity,
        "blocking": str(level) == "error" or (severity is not None and severity >= 7),
        "accepted": False,
        "rule_id": rule_id,
        "name": name,
        "uri": uri,
        "line": line,
        "end_line": end_line,
        "message": _message(result),
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
        try:
            return float(props.get("security-severity"))
        except (TypeError, ValueError):
            return None
    return None


def _location(result: dict) -> tuple[str, int | None, int | None]:
    locations = result.get("locations") or []
    if not locations:
        return "", None, None
    physical = locations[0].get("physicalLocation") or {}
    artifact = physical.get("artifactLocation") or {}
    uri = unquote(artifact.get("uri") or "")
    region = physical.get("region") or {}
    line = region.get("startLine")
    end_line = region.get("endLine")
    if not isinstance(line, int):
        line = None
    if not isinstance(end_line, int):
        end_line = None
    return uri, line, end_line


def _message(result: dict) -> str:
    message = result.get("message") or {}
    text = message.get("text") or message.get("markdown") or ""
    text = " ".join(str(text).split())
    if len(text) > 240:
        text = text[:237] + "..."
    return text


def _render(
    language: str,
    open_findings: list[dict],
    accepted: list[dict],
    blocking: list[dict],
    warnings: list[str],
) -> str:
    total = len(open_findings) + len(accepted)
    lines = [f"### CodeQL ({language})", ""]
    if total == 0 and not warnings:
        lines.append("Keine Funde.")
        lines.append("")
        return "\n".join(lines)

    lines.append(
        f"{_count(total, 'Fund', 'Funde')}, davon {len(blocking)} blockierend "
        f"(Schwere error oder security-severity ab 7), {len(accepted)} akzeptiert."
    )
    lines.append("")
    if accepted:
        lines.append("#### Akzeptierte Funde")
        lines.append("")
        lines.append("| Regel | Ort | pruefenBis | Begründung |")
        lines.append("| --- | --- | --- | --- |")
        for item in accepted:
            lines.append(
                "| {rule} | {place} | {until} | {reason} |".format(
                    rule=_cell(item["rule_id"]),
                    place=_cell(_place(item)),
                    until=_cell(item.get("pruefen_bis") or ""),
                    reason=_cell(item.get("begruendung") or ""),
                )
            )
        lines.append("")
    if open_findings:
        lines.append("#### Offene Funde")
        lines.append("")
        lines.append("| Schwere | Security-Severity | Blockierend | Regel | Ort | Meldung |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        ordered = sorted(
            open_findings,
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
            lines.append(
                "| {level} | {severity} | {blocking} | {rule} | {place} | {message} |".format(
                    level=_cell(item["level"]),
                    severity=_cell(severity),
                    blocking="ja" if item["blocking"] else "nein",
                    rule=_cell(item["rule_id"] or item["name"]),
                    place=_cell(_place(item)),
                    message=_cell(item["message"]),
                )
            )
        lines.append("")
    if warnings:
        lines.append("#### Hinweise zu Ausnahmen")
        lines.append("")
        for warning in warnings:
            lines.append(f"- {_cell(warning)}")
        lines.append("")
    return "\n".join(lines)


def _place(item: dict) -> str:
    if item["uri"] and item["line"]:
        return f"{item['uri']}:{item['line']}"
    return item["uri"] or (str(item["line"]) if item["line"] else "")


def _count(number: int, singular: str, plural: str) -> str:
    word = singular if number == 1 else plural
    return f"{number} {word}"


def _cell(value: str) -> str:
    return str(value).replace("|", "\\|").replace("<", "&lt;")


def _annotate(item: dict) -> None:
    kind = "error" if item["blocking"] else "warning"
    place = item["uri"] or "."
    line = f",line={item['line']}" if item["line"] else ""
    title = item["rule_id"] or "CodeQL"
    severity = "" if item["severity"] is None else f", security-severity {item['severity']:g}"
    message = _command_text(f"{item['level']}{severity}: {item['message']}")
    print(f"::{kind} file={place}{line},title={_command_text(title)}::{message}")


def _notice_accepted(item: dict) -> None:
    place = item["uri"] or "."
    line = f",line={item['line']}" if item["line"] else ""
    message = _command_text(
        f"akzeptiert bis {item.get('pruefen_bis')}: {item.get('begruendung')}"
    )
    print(
        f"::notice file={place}{line},title={_command_text(item['rule_id'])}::{message}"
    )


def _command_text(value: str) -> str:
    return (
        str(value)
        .replace("%", "%25")
        .replace("\r", "%0D")
        .replace("\n", "%0A")
        .replace(",", "%2C")
        .replace(":", "%3A")
    )


def _norm_path(value: str) -> str:
    text = unquote(str(value).replace("\\", "/"))
    while text.startswith("./"):
        text = text[2:]
    return text.lstrip("/")


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
