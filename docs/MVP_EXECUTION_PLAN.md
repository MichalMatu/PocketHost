---
status: active
owner: product
last_reviewed: 2026-11-15
purpose: Short authoritative MVP stage tracker; no automatic test permission
---

# PocketHost — aktywny plan MVP

**Ten dokument zawiera wyłącznie bieżący stan i następny krok.** Historia wykonanych podzadań i ich SHA znajduje się w [wersji archiwalnej z 2026-11-15](https://github.com/MichalMatu/PocketHost/blob/31e54178bc21c4217a33831df809e6e276fd0198/docs/MVP_EXECUTION_PLAN.md), a nie w kontekście każdego kolejnego sprintu. Nie usuwaj historycznych dowodów z Git. Kontynuuj po kolei: **Services → Platform → Hosting → Stabilizacja**.

## Zasady nadrzędne

- **QA / testy / lint / format / typecheck / smoke = OFF we wszystkich trybach, bezterminowo.** Zgoda z 2026-11-14 na testy po etapie została cofnięta 2026-11-15. Każde uruchomienie wymaga **nowej wyraźnej zgody** na jeden konkretny zakres i SHA. Samo zamknięcie etapu, „kontynuuj”, audyt ani deploy nie stanowią zgody.
- **FAST FLOW to tylko code → deploy → verify.** `ops/termux/fast-flow.mjs` nie obsługuje `--tests`. Planner `changed-checks.mjs` nie obsługuje `--run`. `verify-changed.mjs` wyłącznie planuje, dopóki po nowym potwierdzeniu nie otrzyma osobnego `--execute --approved-head=<SHA>`. Patrz [DEV_ITERATION](DEV_ITERATION.md).
- Weryfikacja wdrożenia (owner/PID/start ticks, exact SHA, nienaruszenie obcych usług, guarded rollback, bazowe HTTP) **zawsze obowiązuje** i nie jest testem funkcjonalnym. Błąd/niepewny wynik → **HOLD, bez automatycznej próby**.
- **Szczególna zgoda** nadal wymagana na reboot, SSH, WAN, operacje na obcych procesach, fizyczne testy awarii, zmiany dostępu i dane użytkownika.
- Etap `IN_PROGRESS` → `READY_FOR_ACCEPTANCE` po ukończeniu funkcjonalności i znanych dowodach → `ACCEPTED` tylko po potwierdzeniu właściciela. Bez osobnej zgody na testy wpisuj `TESTS NOT RUN`; nigdy nie udawaj przeprowadzonego QA.

## Baza działająca — A8

- [x] PocketHost DEV na Samsung Galaxy A8 przez Termux/runit; MacBook otwiera panel po prywatnym LAN; menu Services ma osobne strony.
- [x] Dynamiczny Host inventory, RAM/dysk/uptime, Dashboard Basic/Enhanced według obecności Companion/Shizuku, monitoring i odczyty usług, czytelne GiB oraz dni/godziny.
- [x] Zweryfikowany FAST FLOW bez testów. **Live SHA `31e54178bc21c4217a33831df809e6e276fd0198`**, Local Agent task `pockethost-a8-fastflow-tests-off-20261115-v1`: terminal `PASS`, `tests=not-run`, 10.294 s, PID 6057/start ticks 18623453, HTTP 200, chronione usługi bez zmian.
- [ ] **Niepotwierdzone:** pełny odbiór Services, realny reboot/Termux:Boot, wszystkie interakcje z własnym workerem, wykonywanie własnego Python. HTTP 200 i SHA nie dowodzą ich sprawności.

## 1. Services — IN_PROGRESS (jedyny bieżący priorytet)

- [ ] **S1: Inventory + ownership.** Uniwersalne nazwy i bezpieczny enrollment dowolnie nazwanego **własnego** serwisu, bez przejmowania obcych/chronionych procesów; pełny proof: registry, marker, canonical path, run/source SHA. Istnieje lista i częściowa rejestracja szablonowego workera. **Nowe (częściowe):** diagnoza przyczyny odmowy sterowania (brak enrollment, legacy, zmieniona ścieżka/skrypt, konflikt archiwum, usługa systemowa), bez dodania uprawnień; stabilna kolejność inwentarza.
- [ ] **S2: Lifecycle + logs.** Pełne Create → Start/Stop/Restart → readback → logs → archive/restore/retire. Częściowo zaimplementowane (w tym historia źródła Python z CAS); brak pełnego fizycznego odbioru.
- [ ] **S3: Autostart.** Zapisana polityka desired state, runit enable/disable, Termux:Boot i wyjaśniony stan po reboot; prawdziwy reboot tylko za osobną zgodą.
- [ ] **S4: Health/recovery.** Własna konfiguracja readiness/heartbeat, ograniczenia restart-loop, diagnostyka PID/HTTP/UNKNOWN i obsługa drift/rollback. Bez niezatwierdzonego schedulera.
- [ ] **S5: Ręcznie autoryzowane QA.** **Nie uruchamiać domyślnie**, nawet po S1–S4. Najpierw przedstawić zakres testów pozytywnych/negatywnych/UI/API/host i poprosić o osobną zgodę na jedno uruchomienie.
- [ ] **S6: Odbiór użytkownika.** Aktualny panel, exact SHA, bezpieczny receipt, lista potwierdzonych/niepotwierdzonych funkcji, link MacBook; `ACCEPTED` dopiero po decyzji właściciela.

**Python:** w panelu można zapisać i przywracać własny `worker.py` (max 32 KiB). Start/Restart/autostart/recovery dowolnego kodu Python przez niezabezpieczony LAN nadal są **zablokowane**. `-I` nie jest sandboxem. Nie uruchamiaj niezweryfikowanego kodu na A8.

## 2. Platform — NOT_STARTED jako całość

- [ ] **P1:** konfiguracja prywatnego LAN z panelu, trwałość reguły i readback po restarcie.
- [ ] **P2:** Termux/runit/Termux:Boot, reboot tylko po osobnej zgodzie.
- [ ] **P3:** SSH port/klucze/status/polityka odmowy, bez przejęcia zewnętrznego SSH.
- [ ] **P4:** Git/GitHub: konfiguracja i weryfikacja poświadczeń bez ujawniania sekretów.
- [ ] **P5:** bezpieczeństwo LAN bez logowania i odbiór.

## 3. Hosting — NOT_STARTED jako całość

- [ ] **H1:** niezależne Static i Node: Create/import, repo/files, pakiety/build.
- [ ] **H2:** Deploy → runit → Health/Ready → link → logs.
- [ ] **H3:** Update → health gate → rollback.
- [ ] **H4:** bezpieczne odblokowanie feature-gated API Hosting, ścisła własność.
- [ ] **H5:** jednoznaczny odbiór i testy **tylko po odrębnej zgodzie**.

## 4. Stabilizacja MVP — NOT_STARTED

- [ ] **M1:** usunąć martwe/dublujące się ścieżki.
- [ ] **M2:** spójny Backup → Restore w izolacji.
- [ ] **M3:** bezpieczeństwo/awarie/recovery oraz reboot **wyłącznie po osobnej zgodzie**.
- [ ] **M4:** raport znanych luk, live SHA, decyzja użytkownika o końcowym odbiorze.

## Zasada jednej iteracji

1. Świeży `main`, aktualny live SHA i właściciel procesu A8; czytaj tylko `AGENTS.md`, `docs/START_HERE.md`, **ten plan** i najbliższy scoped `AGENTS.md`.
2. Jedna rzeczywista funkcja → commit na `main` → **jedno** zadanie A8 Local Agent z `fast-flow.mjs --apply`, **bez testów i dodatkowych buildów**.
3. Jedyny konieczny dowód: terminal PASS/HOLD, SHA, PID/start ticks, podstawowe HTTP, brak zmian w chronionych usługach. Przy HOLD nie uruchamiaj automatycznych ponowień.
4. Dokumentuj tylko aktualny status, a szczegółowe logi trzymaj w receipt/Git. Dokumentacja-only: commit bez deploy, testów, restartu i formatowania.

**Następny produktowy krok: S1 — domknięcie enrollmentu własnych usług.** 
