# Git GUI Client – Technologie-Recherche & Architekturvorschlag

*Stand: März 2026*

---

## 1. Zielbild & Designphilosophie

Bevor wir in die Technik gehen, lohnt es sich, das Zielbild zu schärfen. Der neue Client soll das Beste aus drei existierenden Clients vereinen:

**Von Tower** übernehmen wir: die aufgeräumte Seitenleiste, die saubere Repository-Verwaltung, den Workflow-orientierten Ansatz (Staging, Commit, Push als geführter Prozess) und die exzellente macOS-Integration.

**Von Fork** übernehmen wir: die schiere Geschwindigkeit, den brillanten Diff-Viewer, den kompakten aber informativen Commit-Graphen und die schnelle Ladezeit auch bei großen Repositories.

**Von GitKraken** übernehmen wir: das attraktive, moderne Dark-Theme, die interaktive Rebase-Oberfläche (Drag & Drop), die visuelle Darstellung von Branch-Strategien und die Pipelineansicht.

Was wir vermeiden: Die aufgeblähte Electron-Schwere von GitKraken (400–500 MB RAM im Leerlauf), die Abhängigkeit von einem Account/Abo wie bei GitKraken, und natürlich die altbackene MFC/WinForms-Optik von GitExtensions.

---

## 2. GUI-Framework: Wails + Go

### 2.1 Entscheidung: Wails 2

**Wails** ist das Go-Äquivalent zu Tauri und die ideale Wahl für dieses Projekt, da das Backend in einer vertrauten Sprache geschrieben werden kann.

Das Grundprinzip ist identisch zu Tauri: Ein **Go-Backend** übernimmt alle nativen Operationen (Git, Dateisystem, Prozesse), während ein **WebView-Frontend** (React + TypeScript) die gesamte UI rendert. Wails verwendet ebenfalls den nativen WebRenderer des Betriebssystems – WKWebView auf macOS, WebView2 auf Windows, WebKitGTK auf Linux – und bundelt kein Chromium.

**Warum Wails für diesen Use Case die richtige Wahl ist:**

Das App-Bundle ist wie bei Tauri drastisch kleiner als bei Electron – typischerweise 8–20 MB statt 150–300 MB. Der RAM-Verbrauch im Leerlauf liegt bei 30–60 MB statt 200–500 MB bei Electron-Apps. Das ist für eine App, die Entwickler den ganzen Tag geöffnet haben, ein riesiger Unterschied.

Go als Backend ist für einen Git-Client sehr gut geeignet: `go-git` ist eine ausgereifte, vollständige Git-Implementierung in reinem Go, die direkt integrierbar ist. Goroutines machen nebenläufige Git-Operationen (z.B. gleichzeitig Fetch + Status-Update) einfach handhabbar, und das IPC zwischen Frontend und Go-Backend ist komfortabel über automatisch generierte TypeScript-Bindings gelöst – man ruft Go-Funktionen direkt aus TypeScript auf wie lokale Funktionen.

Das Frontend kann mit React und modernen UI-Libraries (shadcn/ui, Radix UI, Tailwind CSS) gebaut werden – und hier ist die gesamte Web-Welt verfügbar: jede Komponente, jede Visualisierungsbibliothek, jedes Icon-Set.

macOS-First ist mit Wails gut umsetzbar: native Menüleisten, native Dialoge, App-Notarization für den Mac App Store sind unterstützte Features.

**Einziger Schwachpunkt von Wails:** Wie bei Tauri ist die WebKitGTK-Renderengine auf Linux etwas hinter WKWebView auf macOS. Für bestimmte CSS-Features oder komplexe Animationen kann es auf Linux zu kleinen Abweichungen kommen. Das ist handhabbar, aber erwähnenswert.

### 2.2 Wails IPC – wie die Kommunikation funktioniert

Wails generiert automatisch TypeScript-Typen für alle Go-Funktionen, die als "Bindings" exportiert werden. Das sieht in der Praxis so aus:

```go
// Backend (Go)
func (a *App) GetCommits(repoPath string) ([]Commit, error) {
    // go-git Logik hier
}
```

```typescript
// Frontend (TypeScript) – automatisch generiertes Binding
import { GetCommits } from "../wailsjs/go/main/App";

const commits = await GetCommits("/path/to/repo");
// commits ist vollständig typisiert als Commit[]
```

Das ist erheblich komfortabler als ein manuelles JSON-Protokoll und macht Refactoring sicher.

### 2.3 Nicht empfohlen

**Electron**: Bewährt (VSCode, GitHub Desktop, GitKraken) aber zu schwer. Wenn man schon einen Browser bundelt, verliert man den Performance-Vorteil gegenüber nativem Code.

**Qt (C++/QML)**: Mächtig und performant, aber die Lizenzierung ist komplex (GPL/LGPL/Commercial), das Look-and-Feel auf macOS ist nie wirklich nativ, und C++ ist kein Vorteil gegenüber Go.

**Flutter (Dart)**: Dart ist eine Nischensprache, Go-Kenntnisse sind nicht übertragbar, und Git-Bibliotheken für Dart sind kaum vorhanden.

---

## 3. Tech Stack im Detail

### 3.1 Empfohlener Stack

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (TypeScript)                 │
│                                                         │
│  React 19  ·  Tailwind CSS 4  ·  shadcn/ui              │
│  Zustand (State)  ·  TanStack Query (Async State)       │
│  Monaco Editor (Diff/Merge)  ·  D3.js (Commit Graph)    │
│  Framer Motion (Animationen)  ·  Lucide Icons           │
└─────────────────────┬───────────────────────────────────┘
                      │  Wails IPC (typsicheres Go ↔ TS)
┌─────────────────────▼───────────────────────────────────┐
│                    BACKEND (Go)                          │
│                                                         │
│  go-git (pure Go Git-Implementierung)                   │
│  CLI-Git Fallback für komplexe Operationen              │
│  fsnotify (Filesystem Watcher)                          │
│  Wails 2                                                │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Begründungen zu jedem Element

**React 19**: Bewährtestes UI-Framework, riesiges Ecosystem, Concurrent Features für flüssige UI auch bei großen Datensätzen.

**Tailwind CSS 4**: Utility-First CSS, exzellent für ein konsistentes Design-System. Mit einem eigenen Theme (Farben, Spacing, Shadows) wird der Client unverwechselbar.

**shadcn/ui + Radix UI**: Barrierefreie, schöne Basis-Komponenten (Dialoge, Dropdowns, Tooltips, Contextmenüs) die vollständig anpassbar sind. Kein Vendor-Lock-in.

**Zustand**: Leichtgewichtiger, performanter State Manager für React. Besser als Redux für diesen Use Case.

**TanStack Query**: Für das asynchrone Laden von Git-Daten (Branches, Commits, Diffs) mit Caching, Background Refetching und Suspense-Integration.

**fsnotify**: Go-Library für plattformübergreifendes Filesystem-Watching – benachrichtigt die App wenn sich `.git`-Verzeichnisse ändern, damit die UI automatisch aktualisiert wird.

---

## 4. Git-Integration: Bibliothek vs. CLI

### 4.1 Hybridansatz (Empfehlung)

Der beste Ansatz ist eine Kombination aus beiden Welten:

**go-git** für schnelle, lesende Operationen:

go-git ist eine vollständige, pure-Go-Implementierung von Git, die aktiv weiterentwickelt wird und in vielen Produktionstools eingesetzt wird (u.a. intern bei Atlassian/Bitbucket). Sie arbeitet direkt mit den `.git`-Verzeichnissen auf der Festplatte und liest `.gitconfig` korrekt aus.

- Repository öffnen, Status lesen (`git status`)
- Commits und Branches auflisten (`git log`)
- Diffs berechnen (`git diff`)
- `.gitconfig` auslesen und respektieren
- Blame, refs durchsuchen
- Worktrees verwalten

```go
import "github.com/go-git/go-git/v5"

repo, err := git.PlainOpen("/path/to/repo")
ref, _ := repo.Head()
commits, _ := repo.Log(&git.LogOptions{From: ref.Hash()})
```

**CLI-Git für schreibende und komplexe Operationen:**

- Push, Pull, Fetch (inkl. Auth, SSH, Credential Helper)
- Rebase, Cherry-Pick, Merge
- Submodule-Operationen
- Hooks ausführen
- GPG-Signing
- Interaktiver Rebase

Diese Strategie wird von Fork und Tower (und vielen anderen professionellen Clients) eingesetzt. go-git bietet für lesende Operationen eine erheblich schnellere und einfacher parsbare API als CLI-Output-Parsing, während der CLI-Git für komplexe Operationen garantiert korrekt mit allen `.gitconfig`-Einstellungen, SSH-Agenten und Credential Helpern arbeitet.

### 4.2 go-git Einschränkungen kennen

go-git implementiert nicht alle Git-Features vollständig – insbesondere bei Push/Pull mit komplexen Auth-Szenarien (SSH-Agenten, macOS Keychain, NTLM) gibt es bekannte Lücken. Daher der Hybridansatz: für alles was Netzwerk oder Auth berührt, wird auf den CLI-Git delegiert. Das ist kein Nachteil, sondern eine bewusste Architekturentscheidung.

### 4.3 Konfiguration & Kompatibilität

go-git liest die Standard-Git-Konfigurationshierarchie:
- `~/.gitconfig` (global)
- `.git/config` (repository-lokal)
- `/etc/gitconfig` (system)
- `$XDG_CONFIG_HOME/git/config`

SSH-Schlüssel, GPG-Signing, Custom-Merge-Tools, Hooks – alles funktioniert wie gewohnt, da wir den Git-Client nicht ersetzen sondern ergänzen.

---

## 5. Diff-Viewer & Merge-Tool

### 5.1 Monaco Editor

Der **Monaco Editor** – derselbe Editor-Kern, den VSCode verwendet – ist die überzeugendste Wahl für Diff und Merge.

Die `DiffEditor`-Komponente von Monaco bietet:
- Side-by-Side und Inline Diff-Darstellung
- Syntax-Highlighting für über 80 Sprachen (automatische Spracherkennung)
- Virtuelle Darstellung (rendert nur sichtbare Zeilen, funktioniert auch bei 100.000 Zeilen)
- Vollständig anpassbares Theming

Für den **3-Way-Merge** (das ist anspruchsvoller) kann man entweder:

**Option A**: Einen eigenen 3-Panel-Merge-Viewer auf Basis von Monaco bauen (linke Version, rechte Version, Mitte = Ergebnis). VSCode macht das genauso.

**Option B**: Die `merge-editor`-Komponente die Microsoft seit VSCode 1.69 entwickelt hat und die theoretisch als unabhängige Library extrahierbar wäre – das ist jedoch noch nicht einfach nutzbar außerhalb von VSCode.

Die pragmatische Empfehlung für MVP: Diff mit Monaco, Merge extern per konfigurierbarem Tool (Kaleidoscope, P4Merge, vimdiff). In Version 2 dann eigener integrierter Merge-Editor.

### 5.2 Integration mit @monaco-editor/react

```tsx
import { DiffEditor } from "@monaco-editor/react";

<DiffEditor
  height="100%"
  language="typescript"
  original={originalContent}
  modified={modifiedContent}
  theme="vs-dark"
  options={{
    renderSideBySide: true,
    ignoreTrimWhitespace: true,
    diffWordWrap: "off"
  }}
/>
```

Die Diff-Daten kommen dabei bereits aufbereitet vom Go-Backend via go-git – Monaco muss nur noch den Original- und den Modifizierten-Text rendern, die eigentliche Diff-Logik liegt im Backend.

---

## 6. Commit-Graph Visualisierung

Die visuelle Darstellung des Commit-Graphen ist das "Aushängeschild" jedes Git-Clients. Hier entscheidet sich, ob die App sich professionell anfühlt.

### 6.1 Rendering-Strategie

Für kleine/mittlere Repositories (< 10.000 Commits sichtbar): **Canvas 2D** via React Custom Hook ist ideal – einfach zu implementieren, 60fps, kein WebGL-Overhead.

Für sehr große Repositories: **WebGL** via regl oder pixi.js für millionen von Datenpunkten. Das ist für die meisten Repositories overkill.

**Empfehlung**: Canvas 2D mit virtualisiertem Rendering (nur sichtbare Commits werden gezeichnet). Fork macht das genau so und ist blitzschnell.

### 6.2 Graph-Layout-Algorithmus

Der Git-Commit-Graph ist ein Directed Acyclic Graph (DAG). Das Layout-Problem (wie werden Branches nebeneinander angeordnet?) ist nicht trivial. Die bewährte Lösung:

Ein **Swimlane-Algorithmus** (Column Assignment):
1. Commits topologisch sortieren
2. Jedem Commit eine Spalte zuweisen (Branch-Linien)
3. Merge-Kanten als Kurven zwischen Spalten zeichnen

Dieser Algorithmus wird im **Go-Backend** implementiert und als vorberechnetes Datenarray ans Frontend übergeben. Das Frontend rendert dann nur noch auf dem Canvas – das ist deutlich performanter als das Layout im Frontend zu berechnen. Go eignet sich für diesen Algorithmus sehr gut: einfache Structs, schnelle Maps, klare Goroutine-Parallelisierung für große Repositories.

---

## 7. App-Architektur & Features

### 7.1 Haupt-UI-Bereiche

```
┌──────────────────────────────────────────────────────────────┐
│  [Toolbar: Fetch · Pull · Push · Branch · Stash · ...]       │
├─────────────┬────────────────────────┬───────────────────────┤
│ SIDEBAR     │ COMMIT GRAPH           │ DETAIL PANEL          │
│             │                        │                        │
│ Repos       │  ●─── main            │ Commit-Info           │
│  ├ Branches │  │    feature/login   │ Author, Date, Hash    │
│  ├ Tags     │  ●──╮                 │                        │
│  ├ Remotes  │  ●  ●                 │ ─────────────────────  │
│  ├ Stashes  │  │  ●─── hotfix      │ DIFF VIEWER            │
│  └ Submod.  │  ●──╯                 │ (Monaco DiffEditor)   │
│             │  ●                    │                        │
│             │  ●                    │                        │
├─────────────┴────────────────────────┴───────────────────────┤
│ STAGING AREA                                                  │
│ Unstaged: [file.ts] [README.md]   Staged: [api.ts]          │
│ Inline Diff für ausgewählte Datei (Monaco)                   │
│ [Commit-Message Textfeld]            [Commit Button]         │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Feature-Priorisierung

**Kern-Features (MVP):**
- Repository öffnen / klonen
- Commit-Graph mit Branch-Darstellung
- Staging Area mit Inline-Diff (hunk-level staging)
- Commit erstellen, amenden
- Branch erstellen, wechseln, mergen, löschen
- Push, Pull, Fetch (mit SSH und HTTPS Auth)
- Stash
- Diff-Viewer (Monaco)
- Konfigurierbares externes Merge-Tool

**Version 1.1:**
- Interaktiver Rebase (drag & drop im Graph)
- Cherry-Pick
- Tag-Management
- Submodule-Support
- Blame-Viewer
- Integriertes Merge-Tool (3-Way)

**Version 2.0:**
- GitLab/GitHub PR/MR Integration (optional, opt-in)
- Worktrees
- Partial Clone / Sparse Checkout
- CI-Status-Badges im Commit-Graph

### 7.3 State Management Architektur

```typescript
// Zustand Store - vereinfacht
interface GitStore {
  repositories: Repository[];
  activeRepo: string | null;
  commits: Commit[];
  branches: Branch[];
  workingCopy: WorkingCopyStatus;
  selectedCommit: string | null;

  // Actions
  fetchCommits: (repoPath: string) => Promise<void>;
  stageFile: (filePath: string) => Promise<void>;
  createCommit: (message: string) => Promise<void>;
}
```

TanStack Query (React Query) übernimmt das Caching von Git-Daten mit automatischem Background-Refetch wenn sich das `.git`-Verzeichnis ändert (via `fsnotify` im Go-Backend, das über Wails IPC ein Event ans Frontend schickt).

---

## 8. Design-System & Visual Language

### 8.1 Visuelles Konzept

Inspiriert von den besten Elementen aller drei Vorbilder:

**Farbschema**: Primär Dark Theme (wie GitKraken), mit einem hochwertigen Light Theme. Der Nutzer wählt, oder es folgt dem System-Theme.

**Typography**: JetBrains Mono oder Fira Code für Code/Diff-Bereiche. Inter oder SF Pro für UI-Text. Klare Hierarchy mit 3–4 Schriftgrößen.

**Farben für Branch-Linien**: Ein harmonisches Set von 8–12 Farben (kein Neonregenbogen wie GitKraken, eher gedämpfte aber klar unterscheidbare Töne).

**Spacing & Density**: Mittlere Dichte – nicht so spartanisch wie Tower, nicht so gedrängt wie Fork. Großzügige Click-Targets, gute Lesbarkeit.

**Animationen**: Subtil und schnell (150–250ms). Framer Motion für Page-Transitions und Modals. Keine Animationen die Arbeit verlangsamen.

**Icons**: Lucide Icons (konsistent, clean, open source) + custom Git-spezifische Icons (Branch, Merge, Tag, Stash-Icons).

### 8.2 Besondere UI-Details die Qualität ausmachen

- **Hunk-Level Staging**: Einzelne Zeilen oder Hunks stagen/un-stagen per Klick im Diff-Viewer (wie Tower und Fork es machen, aber besser integriert)
- **Inline Branch-Labels im Graph**: Nicht nur Tooltips, sondern permanente kleine Chips an den Branch-Tips
- **Quick Actions**: Rechtsklick-Contextmenüs die kontextsensitiv die wichtigsten Aktionen zeigen
- **Keyboard First**: Vollständige Keyboard-Navigation (j/k für Commits, Space zum Stagen, etc.)
- **Command Palette** (⌘K): Alles per Tastatur erreichbar – wie in VS Code
- **Repository-Switcher**: Schnelles Wechseln zwischen Repos mit letzten Branches und Status
- **Conflict Marker**: Dateien mit Konflikten prominent hervorheben, direkter Link zum Merge-Tool

---

## 9. Projektstruktur

```
git-client/
├── main.go              # Wails App Entry Point
├── app.go               # App-Struct, Wails Bindings
├── go.mod
│
├── git/                 # Go Backend – Git-Logik
│   ├── repository.go    # Repo öffnen, Status (go-git)
│   ├── commits.go       # Log, Graph-Layout-Algorithmus
│   ├── diff.go          # Diff-Berechnung (go-git)
│   ├── branches.go      # Branch-Operationen
│   ├── staging.go       # Stage/Unstage (go-git)
│   ├── cli.go           # CLI-Git Wrapper (exec.Command)
│   └── watcher.go       # fsnotify Filesystem-Watcher
│
└── frontend/            # React Frontend
    ├── src/
    │   ├── components/
    │   │   ├── CommitGraph/     # Canvas-basierter Graph
    │   │   ├── DiffViewer/      # Monaco DiffEditor
    │   │   ├── StagingArea/     # Staging-Oberfläche
    │   │   ├── Sidebar/         # Navigation
    │   │   └── Toolbar/         # Aktionen
    │   ├── stores/
    │   │   └── gitStore.ts      # Zustand Store
    │   ├── hooks/
    │   │   └── useGitData.ts    # TanStack Query Hooks
    │   └── App.tsx
    └── wailsjs/             # Auto-generierte Go Bindings
        └── go/main/App.d.ts # TypeScript-Typen für Go-Funktionen
```

---

## 10. Entwicklungsplan & Technologie-Risiken

### 10.1 Entwicklungsreihenfolge

**Phase 1 – Foundation (4–6 Wochen):**
Wails-Projekt aufsetzen, Go-Backend mit go-git für Basis-Operationen, Frontend-Grundgerüst mit React + Zustand, einfache Commit-Liste (noch kein Graph).

**Phase 2 – Core Git Features (6–8 Wochen):**
Commit-Graph mit Canvas-Rendering, Staging-Area mit Hunk-Level Diff, Diff-Viewer mit Monaco, Push/Pull mit CLI-Git-Delegation und Auth.

**Phase 3 – Polish & Power Features (6–8 Wochen):**
Interaktiver Rebase, Blame, Merge-Tool-Integration, Command Palette, Keyboard Shortcuts, Light/Dark Themes, fsnotify-basiertes Live-Update.

**Phase 4 – Beta & Distribution (4 Wochen):**
macOS Code-Signing & Notarization, Windows Installer (NSIS/MSI), Linux AppImage/Flatpak/Snap, Auto-Update via Wails Updater.

### 10.2 Risiken & Mitigationsstrategien

**Risiko: WebKitGTK auf Linux suboptimal**
Mitigation: Wails erlaubt Linux-spezifische Overrides; für die erste Version Linux als "Tier 2" behandeln.

**Risiko: Monaco Editor Bundle-Größe (~8 MB)**
Mitigation: Monaco lazy-loaden – erst wenn der Diff-Bereich aufgerufen wird. Vite's code splitting macht das einfach.

**Risiko: go-git Auth-Probleme (SSH Agent, macOS Keychain)**
Mitigation: Für alles was Netzwerk berührt (Push, Pull, Fetch, Clone) immer CLI-Git verwenden; go-git nur für lokale/lesende Operationen.

**Risiko: Commit-Graph Performance bei sehr großen Repos (100k+ Commits)**
Mitigation: Virtualisiertes Rendering (nur sichtbarer Bereich), Go-seitiges Pre-Computing des Graph-Layouts mit Pagination, Progressive Loading der Commit-Historie.

**Risiko: Wails weniger verbreitet als Tauri**
Mitigation: Wails v2 ist produktionsreif und wird aktiv weiterentwickelt. Das Community-Ecosystem ist kleiner, aber für diesen Anwendungsfall ist alles Notwendige vorhanden. Der Vorteil (Go statt Rust) überwiegt deutlich.

---

## 11. Nächste konkrete Schritte

1. **Proof-of-Concept**: Wails + React + go-git – ein Repository öffnen, 100 Commits laden, im Canvas rendern. Zeigt ob der Stack funktioniert und wie sich das IPC anfühlt.

2. **Design-Prototype**: In Figma (oder ähnlich) das UI-Konzept ausarbeiten – Farben, Typography, die wichtigsten Screens.

3. **Graph-Layout in Go prototypen**: Den Swimlane-Algorithmus isoliert implementieren und mit einem echten Repository (z.B. dem Linux-Kernel-Repo mit 1M+ Commits) gegen Performance-Ziele testen.

4. **Auth-Strategie klären**: Wie sollen SSH-Keys und HTTPS-Credentials verwaltet werden? System-native Keychain (macOS Keychain, Windows Credential Manager) via CLI-Git ist die einfachste Lösung.

5. **Projekt-Name & Branding**: Ein guter Name und ein schönes App-Icon machen den ersten Eindruck.

---

## Referenzen & weiterführende Links

- [Wails Dokumentation](https://wails.io/docs/introduction)
- [Wails GitHub](https://github.com/wailsapp/wails)
- [go-git Dokumentation](https://pkg.go.dev/github.com/go-git/go-git/v5)
- [go-git GitHub](https://github.com/go-git/go-git)
- [Monaco Editor React](https://monaco-react.surenatoyan.com/)
- [shadcn/ui Komponenten](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/)
- [fsnotify (Go Filesystem Watcher)](https://github.com/fsnotify/fsnotify)
- [TanStack Query](https://tanstack.com/query/latest)
- [Framer Motion](https://www.framer.com/motion/)
