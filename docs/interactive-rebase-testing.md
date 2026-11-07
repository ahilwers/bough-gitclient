# Interactive Rebase Testing

## Was gebaut wurde

### Go-Backend (`app/git/rebase.go` — neu)

- **StartInteractiveRebase** — schreibt ein Rebase-Todo-File, startet `git rebase --interactive` mit `GIT_SEQUENCE_EDITOR`, das die vorbereiteten Aktionen injiziert. reword-Aktionen werden automatisch in `pick + exec git commit --amend -F <tmpfile>` umgewandelt, damit kein Editor aufgeht. `--autostash` verhindert Fehler bei uncommitteten Änderungen.
- **DetectRebaseState** — liest `.git/rebase-merge/` und liefert Fortschritt (Step X/Y), Branch-Name und Konfliktanzahl.
- **ContinueRebase / AbortRebase** — setzen Rebase fort oder brechen ihn ab.
- **CommitsOnRemote** — gibt an, welche Commit-Hashes bereits auf dem Remote-Branch sind (über `@{upstream}..HEAD`).

### Frontend

- **RebaseSequenceEditor.tsx** — Modal mit Drag & Drop zum Umsortieren, klickbaren Action-Badges (pick → reword → squash → fixup → drop → pick), Inline-Bearbeitung der Commit-Message per Doppelklick, und "pushed"-Warnung für bereits gepushte Commits.
- **useRebase.ts** — TanStack-Mutation-Hook für start / continue / abort.
- **Kontextmenü in CommitRow.tsx** — neue Einträge: "Reword Commit…", "Squash into Parent", "Drop Commit", "Interactive Rebase from here…".
- **Dialoge in CommitList.tsx** — Reword-Dialog (Texteingabe + ⌘Enter) und Drop-Bestätigungsdialog.
- **REBASING-Banner in ChangesView.tsx** — erscheint bei Konflikt in Rot (wie der Merge-Banner) mit "Continue"- und "Abort Rebase"-Buttons.

✻ Cooked for 11m 15s

## Wie kann ich das denn jetzt am besten testen?

### Einfacher Test mit einem frischen Test-Repo

#### 1. Test-Repo anlegen

```bash
mkdir /tmp/rebase-test && cd /tmp/rebase-test
git init
echo "A" > file.txt && git add . && git commit -m "Initial commit"
echo "B" >> file.txt && git add . && git commit -m "Add B"
echo "C" >> file.txt && git add . && git commit -m "Add C — typo in message"
echo "D" >> file.txt && git add . && git commit -m "WIP: cleanup"
echo "E" >> file.txt && git add . && git commit -m "Add feature E"
```

#### 2. App starten

```bash
cd /path/to/bough/app && wails dev
```

#### 3. Test-Szenarien

| Was testen | Wie vorgehen |
|------------|--------------|
| Reword | Rechtsklick auf "Add C — typo" → "Reword Commit…" → Nachricht korrigieren → git log prüfen |
| Interactive Rebase Editor | Rechtsklick auf "Add B" → "Interactive Rebase from here…" → Editor zeigt B–E, Drag & Drop B und C tauschen → Rebase |
| Squash | Rechtsklick auf "WIP: cleanup" → "Squash into Parent" → wird mit "Add C" zusammengeführt |
| Drop | Rechtsklick auf "WIP: cleanup" → "Drop Commit" → Bestätigen |
| Aktionen im Editor durchschalten | Editor öffnen → auf pick-Badge klicken → Badge wechselt zu reword → squash → fixup → drop → pick |
| Konflikt provozieren | Zwei Commits, die dieselbe Zeile ändern, umordnen → REBASING-Banner erscheint in Changes-View |

### 4. Konflikt-Test (fortgeschritten)

```bash
# Konfliktierendes Setup: zwei Commits ändern die gleiche Zeile
echo "version: 1" > config.txt && git add . && git commit -m "Set version 1"
echo "version: 2" > config.txt && git add . && git commit -m "Set version 2"
echo "version: 3" > config.txt && git add . && git commit -m "Set version 3"
```

Dann die letzten beiden im Editor umdrehen → Konflikt → REBASING-Banner erscheint → Konflikt in Changes-View lösen → "Continue".

### 5. Schnellprüfung per Terminal

```bash
# Nach jedem Test-Rebase prüfen:
cd /tmp/rebase-test && git log --oneline
```