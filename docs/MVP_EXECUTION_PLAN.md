---
status: active
owner: product
last_reviewed: 2026-11-16
purpose: Short authoritative MVP stage tracker; no automatic test permission
---

# PocketHost — aktywny plan MVP

**Ten dokument zawiera wyłącznie bieżący stan i następny krok.** Historia wykonanych podzadań i ich SHA znajduje się w [wersji archiwalnej z 2026-11-15](https://github.com/MichalMatu/PocketHost/blob/31e54178bc21c4217a33831df809e6e276fd0198/docs/MVP_EXECUTION_PLAN.md), a nie w kontekście każdego kolejnego sprintu. Nie usuwaj historycznych dowodów z Git. Kontynuuj po kolei: **Services → Platform → Hosting → Stabilizacja**.

## Zasady nadrzędne

- **QA / testy / lint / format / typecheck / smoke = OFF we wszystkich trybach, bezterminowo.** Zgoda z 2026-11-14 na testy po etapie została cofnięta 2026-11-15. Każde uruchomienie wymaga **nowej wyraźnej zgody** na jeden konkretny zakres i SHA. Samo zamknięcie etapu, „kontynuuj”, audyt ani deploy nie stanowią zgody.
- **FAST FLOW to tylko code → deploy → verify.** `ops/termux/fast-flow.mjs` nie obsługuje `--tests`. Planner `changed-checks.mjs` nie obsługuje `--run`. `verify-changed.mjs` wyłącznie planuje, dopóki po nowym potwierdzeniu nie otrzyma osobnego `--execute --approved-head=<SHA> --approved-checks=<kategorie>`. Patrz [DEV_ITERATION](DEV_ITERATION.md).
- Weryfikacja wdrożenia (owner/PID/start ticks, exact SHA, nienaruszenie obcych usług, guarded rollback, bazowe HTTP) **zawsze obowiązuje** i nie jest testem funkcjonalnym. Błąd/niepewny wynik → **HOLD, bez automatycznej próby**.
- **Szczególna zgoda** nadal wymagana na reboot, SSH, WAN, operacje na obcych procesach, fizyczne testy awarii, zmiany dostępu i dane użytkownika.
- Etap `IN_PROGRESS` → `READY_FOR_ACCEPTANCE` po ukończeniu funkcjonalności i znanych dowodach → `ACCEPTED` tylko po potwierdzeniu właściciela. Bez osobnej zgody na testy wpisuj `TESTS NOT RUN`; nigdy nie udawaj przeprowadzonego QA.

## Baza działająca — A8

- [x] PocketHost DEV na Samsung Galaxy A8 przez Termux/runit; MacBook otwiera panel po prywatnym LAN; menu Services ma osobne strony.
- [x] Dynamiczny Host inventory, RAM/dysk/uptime, Dashboard Basic/Enhanced według obecności Companion/Shizuku, monitoring i odczyty usług, czytelne GiB oraz dni/godziny.
- [x] Zweryfikowany FAST FLOW bez testów. **Live A8 `b409035f6094f12cc419b3420f240e3e9b2242d8`** (PASS, PID 9342, HTTP 200, usługi chronione bez zmian), receipt `pockethost-a8-heartbeat-choice-fast-flow-20261116-v1`. Ostatnie QA 7/7 dotyczy starszego źródła `c0bf0218`; **aktualnej wersji nie testowano**.
- [ ] **Niepotwierdzone:** pełny odbiór Services, realny reboot/Termux:Boot, wszystkie interakcje z własnym workerem, wykonywanie własnego Python. HTTP 200 i SHA nie dowodzą ich sprawności.

## Sprint 2026-11-16 — potwierdzone wyniki i granice

- **Services S1–S4, własny fixed worker:** `pockethost-a8-s1-s4-complete-owned-flow-396058d2-20261116-v1` — terminal PASS dla utworzenia, rejestracji, startu, Health, logów, review recovery, stop, archiwum, restore i retire. Własna jednostka wycofana; obce usługi bez zmian. **Nie** dowodzi autostartu po reboot ani bezpiecznego uruchamiania kodu użytkownika.
- **Platform:** poprawiona niezależna weryfikacja LAN po zmianie, widok **Settings → Platform** oraz bezpieczny read-only status Git (bez haseł, tokenów i sieciowego fetch). `pockethost-a8-platform-git-overview-fast-flow-20261116-v1` PASS. Konfiguracja SSH i fizyczny reboot nadal nieodebrane.
- **Hosting:** statyczne deploy/start/stop/rollback/restore/prune wymagają odczytu dokładnej strony po akcji i zgodności release/state przed komunikatem sukcesu. `pockethost-a8-hosting-static-exact-readback-fast-flow-20261116-v1` PASS; brak fizycznego odbioru całego procesu H1–H4.
- **Hosting — kolejny zakres:** Create potwierdza nową stronę w niezależnym inwentarzu; działające deploy, restore i rollback potwierdzają HTTP 200, właściciela oraz identyczną zawartość aktywnego `index.html`. Nieudana weryfikacja przywraca poprzedni znacznik wydania. Serwer zwraca też identyfikator dokładnie wybranego wydania; bramka porównuje go z oczekiwanym wraz z treścią. `pockethost-a8-hosting-release-identity-fast-flow-20261116-v1` PASS na A8 (`e80190677a63269cf9846650b4a84c9f7edb91a7`, PID 12730). Test dla identycznej treści kolejnych wydań jest zapisany w `tests/quality/site-fleet-releases.test.mjs`, lecz **nie został uruchomiony**. `pockethost-a8-hosting-create-exact-readback-fast-flow-20261116-v1` i `pockethost-a8-hosting-release-content-gate-fast-flow-20261116-v1` — FAST FLOW PASS, **TESTS NOT RUN**, bez fizycznej publikacji strony.
- **Stabilizacja:** Restic UI weryfikuje kody wyniku, listę snapshotów i izolowane staging po Restore. `pockethost-a8-stabilization-restic-readback-fast-flow-20261116-v1` PASS. Realne operacje Backup/Restore **nie były uruchamiane**.
- Wszystkie wdrożenia: kod → wdrożenie → operational readback, exact SHA / PID / HTTP, usługi chronione bez zmian; **TESTS NOT RUN** na `b409035f6094f12cc419b3420f240e3e9b2242d8`. Brak schedulera, SSH, WAN i restartu urządzenia. Etapy pozostają **IN_PROGRESS**, żaden nie jest **ACCEPTED**.

- **Services inventory fail-closed (2026-11-16):** przeładowanie listy Runit lub Health natychmiast unieważnia stare dane, widoczne kontrole lifecycle, zapisane podglądy/recenzje recovery i HTTP. Przy błędzie pobrania lub niepoprawnym JSON stare uprawnienia UI nie wracają; backend nadal oddzielnie weryfikuje własność i wykonanie. `pockethost-a8-inventory-failclosed-fast-flow-20261116-v1` terminal done/exit 0, FAST FLOW PASS, live `70e3d9523d0d0efdd0d50887043478caa8494983`, PID 16799, start ticks 27467504, HTTP 200, protected unchanged; **TESTS NOT RUN**. Test odmowy odświeżenia zapisano, ale nie wykonano. Bez funkcjonalnego odbioru.
- **Services S4 heartbeat exact policy readback (2026-11-16):** panel potwierdza wyłącznie **właśnie wybrany** próg heartbeat 180/300/600 s albo disabled, a nie dowolną wzajemnie spójną odpowiedź POST i GET. Weryfikuje changed (także idempotentny zapis), typ/stan policy, proces i timestamp ponownego odczytu. `pockethost-a8-heartbeat-choice-fast-flow-20261116-v1` terminal done/exit 0, guarded FAST FLOW PASS, live `b409035f6094f12cc419b3420f240e3e9b2242d8`, PID 9342, ticks 27549650, HTTP 200, protected unchanged; **TESTS NOT RUN**. Dodany regresyjny scenariusz negatywny pozostał nieuruchomiony; brak pełnego odbioru S4.
- **Services Health (2026-11-16):** ekran ręcznego HTTP readiness oferuje sondowanie wyłącznie zweryfikowanym workerom standalone. Usługi delegowane odsyła do Hosting, bez wysyłania HTTP probe. `pockethost-a8-health-http-worker-only-fast-flow-20261116-v1` PASS, live `27a3015a6278fa07b02b527bdb935a4682b9956a`; **QA NOT RUN**. Nie oznacza odbioru S1–S4.

## 1. Services — IN_PROGRESS (częściowo odebrany fizycznie)

- [ ] **S1: Inventory + ownership.** Uniwersalne nazwy i bezpieczny enrollment dowolnie nazwanego **własnego** serwisu, bez przejmowania obcych/chronionych procesów; pełny proof: registry, marker, canonical path, run/source SHA. Istnieje lista i częściowa rejestracja szablonowego workera. **Nowe (częściowe):** diagnoza przyczyny odmowy sterowania (brak enrollment, legacy, zmieniona ścieżka/skrypt, konflikt archiwum, usługa systemowa), bez dodania uprawnień; stabilna kolejność inwentarza; odczyt tożsamości skryptu `run` przez `O_NOFOLLOW` i weryfikację deskryptora. Wdrożenie wcześniejszej wersji na A8 potwierdzone. **Nowy kod (wdrożony na A8, nieodebrany funkcjonalnie):** Create, Restore, Archive i Retire wymagają zgodnego readback rejestru, stanu zatrzymania, autostartu i archiwum przed komunikatem sukcesu. QA i testy dopiero na końcu, po osobnej zgodzie.
- [ ] **S2: Lifecycle + logs.** Create → Start/Stop/Restart → readback → logs → archive/restore/retire. **Nowa bramka:** każda komenda runit wymaga potwierdzenia `changed:true`, `result.exit:0` i poprawnego wyniku przed niezależnym readback. `pockethost-a8-runit-command-receipt-fast-flow-20261116-v1` PASS, live `3dbba591149dd7250cd5c956f3998170120eb57b`; QA i test regresji napisane, **NOT RUN**. **Kod wdrożony:** Start/Stop/Restart wymagają potwierdzenia stanu i niezmienionej własności; logi mają wyszukiwarkę, filtry błędów/ostrzeżeń i ręczne odświeżanie; poprawione wywołania Node.js source review/history. Nadal brak pełnego funkcjonalnego odbioru.
- [ ] **S3: Autostart.** Zapisana polityka runit `down` (enable/disable z readback); **wdrożono:** read-only podgląd Termux:Boot bez odczytu/wykonywania skryptów, porównanie zapisanego desired-state z bieżącym stanem runit dla zweryfikowanych workerów (w tym mismatch/unknown i zablokowany kod użytkownika), zbiorcze odświeżenie obu części. Nie ma automatycznego reconciliation ani schedulera; przyznane uprawnienia Android, uruchomienie po reboot i pełny odbiór są niepotwierdzone. Fizyczny reboot tylko za osobną zgodą.
- [ ] **S4: Health/recovery.** Własna konfiguracja readiness/heartbeat, ograniczenia restart-loop, diagnostyka PID/HTTP/UNKNOWN i obsługa drift/rollback. **Wdrożono:** health widzi własne usługi Node.js, konfiguruje heartbeat stałych zweryfikowanych workerów, przed ręcznym recovery ponownie sprawdza właściciela i limit prób oraz odczytuje stan po komendzie. Jednorazowy snapshot do czterech workerów z runit/heartbeat/UNKNOWN/niezweryfikowanymi rejestracjami. **Nowe:** PID, uptime i proc start ticks są pokazywane tylko po porównaniu odczytów runit z /proc i UID; przy zmianie procesu status niezweryfikowany. Bez schedulera, automatycznej naprawy i fałszywego READY. Nadal brak pełnego fizycznego odbioru i konfigurowalnego HTTP readiness dla dowolnych aplikacji.
- [x] **Naprawione S4 2026-11-16:** wcześniejszy HOLD/rollback i błędy syntax, format oraz TypeScript usunięte. Kod HTTP readiness działa na A8 jako `47fdfd428ccf7911a7f9a71f7c63c76edfdee5b3` (guarded deployment PASS); testy Node/UI oraz typy na aktualnym źródle przeszły. Nie oznacza to odbioru funkcjonalnego wszystkich workerów ani autostartu po reboot.
- [x] **S5: Ręcznie autoryzowane QA dla zmiany HTTP readiness.** `c0bf02184c804d93fca7a50cddbdd9b1146ee2c8` — **7/7 PASS**: format, structure, boundaries, root-types, admin-types, node, ui. Receipt `pockethost-a8-s4-final-qa-c0bf0218-20261116-v1`. Źródło QA jest o poprawiony mock testu UI nowsze od działającego kodu `47fdfd428ccf7911a7f9a71f7c63c76edfdee5b3`; brak wymogu deploya samego testu. Fizyczny reboot, aktywacja własnego kodu i pełny odbiór S1–S4 nadal niepotwierdzone.
- [ ] **S6: Odbiór użytkownika.** Aktualny panel, exact SHA, bezpieczny receipt, lista potwierdzonych/niepotwierdzonych funkcji, link MacBook; `ACCEPTED` dopiero po decyzji właściciela.

**Własne aplikacje:** A8 ma już potwierdzone wdrożenie tworzenia prywatnego `worker.py` i `worker.mjs` (max 32 KiB), SHA-256 i read-only review. **Wdrożone, bez testów funkcjonalnych:** edycja Node.js poprzez dokładny SHA (CAS), do 8 prywatnych wersji i restore bez wykonania kodu; zachowuje lock i wymóg stopped/autostart-disabled. **Wdrożone, nieodebrane funkcjonalnie:** odczyt rejestru własności, znaczników workera i archiwum przez `O_NOFOLLOW`, z kontrolą deskryptora/inode. Brakujący wpis runit wcześniej zarejestrowanej usługi jest widoczny jako `service-not-published`, zablokowany do ręcznej diagnostyki; nie przyznaje to prawa do uruchomienia. **Nowy kod wdrożony, bez testów funkcjonalnych:** jednostka z zachowanym SHA skryptu `run`, ale zmienionym markerem/loggerem/źródłem/publikacją, nie jest już mylona z delegowanym Node Hosting; Services oznacza ją jako `worker-provenance-changed` i blokuje sterowanie. Poprzednie zadanie `pockethost-a8-node-provenance-readback-20261115-v1` miało `HOLD` (`base-sha-drift`); późniejsze zadanie wdrożyło całość, nie było retry tamtego zadania. Dla obu runtime Start/Restart/autostart/recovery przez LAN nadal są **zablokowane**. Node.js i `python -I` nie są sandboxami. Uruchamianie własnego kodu wymaga osobnej, uwierzytelnionej autoryzacji właściciela; QA na samym końcu.

## 2. Platform — IN_PROGRESS (bez odbioru całego etapu)

- [ ] **P1:** konfiguracja prywatnego LAN z panelu, trwałość reguły i readback po restarcie.
- [ ] **P2:** Termux/runit/Termux:Boot, reboot tylko po osobnej zgodzie.
- [ ] **P3:** SSH port/klucze/status/polityka odmowy, bez przejęcia zewnętrznego SSH.
- [ ] **P4:** Git/GitHub: konfiguracja i weryfikacja poświadczeń bez ujawniania sekretów.
- [ ] **P5:** bezpieczeństwo LAN bez logowania i odbiór.

## 3. Hosting — IN_PROGRESS (bez odbioru całego etapu)

- [ ] **H1:** niezależne Static i Node: Create/import, repo/files, pakiety/build.
- [ ] **H2:** Deploy → runit → Health/Ready → link → logs.
- [ ] **H3:** Update → health gate → rollback.
- [ ] **H4:** bezpieczne odblokowanie feature-gated API Hosting, ścisła własność.
- [ ] **H5:** jednoznaczny odbiór i testy **tylko po odrębnej zgodzie**.

## 4. Stabilizacja MVP — IN_PROGRESS (bez odbioru całego etapu)

- [ ] **M1:** usunąć martwe/dublujące się ścieżki.
- [ ] **M2:** spójny Backup → Restore w izolacji.
- [ ] **M3:** bezpieczeństwo/awarie/recovery oraz reboot **wyłącznie po osobnej zgodzie**.
- [ ] **M4:** raport znanych luk, live SHA, decyzja użytkownika o końcowym odbiorze.

## Zasada jednej iteracji

1. Świeży `main`, aktualny live SHA i właściciel procesu A8; czytaj tylko `AGENTS.md`, `docs/START_HERE.md`, **ten plan** i najbliższy scoped `AGENTS.md`.
2. Jedna rzeczywista funkcja → commit na `main` → **jedno** zadanie A8 Local Agent z `fast-flow.mjs --apply`, **bez testów i dodatkowych buildów**.
3. Jedyny konieczny dowód: terminal PASS/HOLD, SHA, PID/start ticks, podstawowe HTTP, brak zmian w chronionych usługach. Przy HOLD nie uruchamiaj automatycznych ponowień.
4. Dokumentuj tylko aktualny status, a szczegółowe logi trzymaj w receipt/Git. Dokumentacja-only: commit bez deploy, testów, restartu i formatowania.

**Następny produktowy krok:** domknąć niepotwierdzone ścieżki S1–S4 i Platform; dla reboot, SSH/WAN, uruchamiania własnego kodu i rzeczywistego Backup → Restore wymagana jest osobna zgoda. Hosting i stabilizacja mają wdrożony częściowy kod, ale nie są odebrane.
