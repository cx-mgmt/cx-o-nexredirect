# Sicherheit

## Schwachstelle melden

Sicherheitsprobleme bitte vertraulich an **security@corexmanagement.de**. Kein öffentliches Issue, und keine Details in einem Pull Request, solange noch kein Fix draußen ist.

Wir antworten in der Regel innerhalb von drei Werktagen und sagen Bescheid, wenn der Stand sich ändert.

## Unterstützte Stände

Sicherheitsfixes gehen auf `prod`. Wenn `preview` noch ausgerollt ist, bekommt der Branch denselben Fix.

## Prüfungen in der Pipeline

Trivy schaut bei jedem Lauf auf Dependencies und auf das Container-Image. Der Scan schreibt einen Bericht und hält das Deployment nicht an.
