---
status: active
owner: product
last_reviewed: 2026-11-14
purpose: Canonical ordered MVP completion and acceptance tracker
---

# PocketHost — plan domykania MVP i odbiorów

**Obowiązujący plan realizacji.** Po zmianie kodu aktualizuj checklistę i dowody w tym pliku w tym samym commicie lub bezpośrednio po potwierdzonym wdrożeniu. Kolejność można zmienić tylko po nowej decyzji właściciela. **Nie buduj nowych pustych szkieletów funkcji; domykaj rozpoczęte elementy jako pełne pionowe flow.**

## Statusy i reguła ukończenia

- `[x]` = faktycznie wykonane i potwierdzone wskazanym dowodem; `[ ]` = brak pełnego dowodu, nawet gdy część kodu już istnieje.
- Etap: **IN_PROGRESS** → **READY_FOR_ACCEPTANCE** (funkcje + uruchomione testy + raport + działający aktualny panel) → **ACCEPTED** (właściciel potwierdził odbiór).
- **Nie oznaczaj etapu jako ACCEPTED ani wszystkich jego punktów `[x]` bez potwierdzenia użytkownika.** W razie błędów testów lub niepewnego wdrożenia: **HOLD**, poprawka i ponowny odbiór wyłącznie po ustaleniu stanu, bez automatycznych prób.
- Testy nie służą do ciągłego audytowania każdego commitu. **Właściciel wyraźnie autoryzował teraz testy po zakończeniu całego etapu** (testy pozytywne, negatywne, regresja zmienianego zakresu, UI/API/host według ryzyka). W trakcie implementacji nadal bez domyślnych testów/lint/typecheck/QA. Weryfikacja SHA, własności i HTTP przy każdym wdrożeniu nadal obowiązkowa.
- Operacje fizyczne lub ryzykowne (np. prawdziwy reboot, zmiana SSH dostępności, usługi spoza PocketHost, zmiana sieci, WAN, danych) wymagają **odrębnej, konkretnej zgody**. Sama zgoda na testy etapu nie upoważnia do nich.
- Nie mylić statusu procesu z HTTP readiness; nie mylić wpisu w UI z działającym backendem; nie mylić `git main` z wdrożonym A8 SHA.

## 0. Zaakceptowana baza — stan wykonania

- [x] Samsung A8: panel PocketHost uruchomiony pod nadzorem własnego runit, watchdog, znana tożsamość i live-SHA; wcześniejsze potwierdzone deployment receipts.
- [x] Panel dostępny na MacBooku przez prywatny Wi-Fi LAN bez hasła; właściciel potwierdził, że działa (2026-11-14); brama A8 zwróciła `healthy` i HTTP 200. **Nie dowodzi to jeszcze autostartu po reboot.**
- [x] Główne menu uporządkowane: Overview → Hosting → Services → System & Tools → Automation → Settings; przykłady framework/CMS zachowane na samym dole. Właściciel potwierdził wygląd i działanie (2026-11-14).
- [x] Osobne strony Services: przegląd (tylko nawigacja), Runit, Autostart, Hosting workloads, Health checks, Local Agent, SSH, Cloudflare i MQTT. Istniejące strony `/services` nie wykonują wszystkich odczytów naraz.
- [x] Usunięto aktywne sztywne integracje konkretnych hostowanych aplikacji, obserwacja runit jest dynamiczna; historycznych dokumentów nie usuwać.
- [ ] Testy kompletnego hostingu, autostartu po realnym restarcie i polityk recovery — **nie były wykonywane**. Nie wynika z tego, że wcześniejsze punkty to ukończony Etap 1.

**Baza live A8:** `e4838cd472a0db57bf0760ae2a384a97035fdc94` (receipt `pockethost-a8-framework-demo-menu-20261114-v2`, FAST FLOW PASS, HTTP 200, 2026-11-14). Aktualny live-SHA zawsze odczytaj ponownie przed następnym wdrożeniem.

## 1. Services — jeden działający mechanizm zarządzania usługami

**Status: IN_PROGRESS. Priorytet nr 1.** Uniwersalny system; żadnych nazw, domen i ścieżek cudzych projektów wpisanych na stałe.

- [ ] **S1 — Inventory + ownership:** dynamiczna lista, jawna rejestracja **dowolnie nazwanej** usługi po weryfikacji ścieżek, pochodzenia i odzyskiwalnego prawa kontroli; chronione/usługi zewnętrzne tylko do odczytu bez zapisanej zgody. Istnieje lista i częściowa rejestracja, ale prefiks `pockethost-` ogranicza uniwersalność.
- [ ] **S2 — Lifecycle + logs:** Create/enroll → Start/Stop/Restart → readback własności/stanu → logi → bezpieczne unregister. Część endpointów i przycisków istnieje, ale pełny przepływ nie jest zamknięty.
- [ ] **S3 — Autostart:** jawny, zapisywany w panelu desired state, runit enable/disable, integracja z Termux:Boot oraz diagnoza po restarcie; brak niepotrzebnego własnego supervisora.
- [ ] **S4 — Health / recovery:** konfiguracja readiness dla usługi, interwał obserwacji, limitowane restarty, rozróżnienie PID/HTTP/UNKNOWN, ochrona przed restart-loop, widoczny wynik i polityka rollback. Nie dodawaj niezatwierdzonego background schedulera.
- [ ] **S5 — Testy etapu Services:** bezpieczny syntetyczny serwis testowy należący do PocketHost; testy pozytywne i odmowy na cudzych usługach, restart/recovery i UI (uruchomić dopiero po domknięciu funkcji); udokumentować pokrycie i luki.
- [ ] **S6 — Odbiór:** wdrożony panel A8, potwierdzony exact SHA + PID/start ticks + HTTP + LAN + izolacja usług, raport wyników, link do MacBooka i akceptacja użytkownika.

**Postęp S1 (częściowy, NIE `[x]`):** odczyt upstream `termux-services` / `runit` potwierdza istniejący supervisor. W kodzie S1 zostaje wprowadzony zaufany, wewnętrzny `registerProvisioned` z kanoniczną ścieżką i skrótem skryptu zamiast rejestracji po samym prefiksie. Rejestracja z przeglądarki nie może przejąć znalezionej usługi. Kolejne: bezpieczne tworzenie i enrollment dowolnie nazwanego własnego serwisu, pełna diagnostyka tożsamości oraz testy na zamknięcie całego Services. Szczegóły: [S1 upstream reuse](S1_RUNIT_REUSE.md). Status nadal **IN_PROGRESS**. Przy normalnej iteracji nie uruchamiać testów.

**S1 checkpoint 2026-11-14:** commit `0d2493f2d5bfa9b41ba8bf9e1c87e74d67950a82`, receipt `pockethost-a8-service-enrollment-provenance-20261114-v1`: terminal `PASS`, A8 DEV live SHA `0d2493f2d5bfa9b41ba8bf9e1c87e74d67950a82`, panel PID 7904, HTTP 200, runit/Local Agent i usługi chronione bez zmian, `tests=not-run`. To jest wdrożona część S1, **nie** zamknięcie etapu; wszystkie pola S1–S6 pozostają `[ ]` do ich pełnego potwierdzenia i odbioru.

**Kolejna iteracja S1 (nadal częściowa, bez `[x]`):** implementacja trwałej tożsamości `runSha256` dla usług utworzonych przez PocketHost, weryfikacji przy każdym odczycie/wywołaniu i automatycznej blokady sterowania po zmianie skryptu/ścieżki. Starsze rejestracje bez skrótu mają status `legacy` (tylko odczyt), a podmiana skryptu `changed` (brak uprawnień). Zaufany moduł Node aktualizuje zapisany digest po własnym wdrożeniu. UI pokazuje stany weryfikacji, zamiast mylić wykrycie z własnością; wejście do Projects to wskazówka istniejącej ścieżki tworzenia usług Node, nie nowy dowolny creator. S1 jako całość nadal **IN_PROGRESS** i testy/odbiór są przed nami.

**S1 checkpoint — integralność skryptów wdrożona na A8:** commit `328f13191416fe5ba8d95a2cc12ccc306a77260d`, wynik `pockethost-a8-service-run-integrity-20261114-v1` `PASS` (live SHA `328f13191416fe5ba8d95a2cc12ccc306a77260d`, PID 18112, HTTP 200, chronione usługi bez zmian, `tests=not-run`). Kontrola digestu `run` odbywa się przy zarządzaniu; UI sygnalizuje `verified` / `changed` / `legacy` / `unregistered` / `reserved`. **Nadal brak ogólnego kreatora usług i odbioru S1/S2/S3/S4**; nie oznaczać etapu jako `[x]`.

**S1 kolejny podetap (implementacja, nie odbiór):** `Runit services → Add Service` tworzy
odrębną od Project usługę na podstawie **ograniczonego, wbudowanego szablonu
`heartbeat-worker-v1`**. Nowy unit jest początkowo zatrzymany i z wyłączonym
autostartem; istniejących jednostek nie można przejąć. Nazwa nie oznacza
własności: zapis w rejestrze następuje dopiero po zweryfikowanym stworzeniu
skryptu przez PocketHost. Zwolnienie kontroli wymaga zatrzymanej i
wyłączonej usługi, pozostawia jej pliki i logi. Ten pierwszy szablon nie
oznacza jeszcze obsługi własnego kodu JS/Python ani kompletnego przepływu
usuwania/rollbacku, więc S1 i S2 nie są ukończone. [Kontrakt](S1_RUNIT_REUSE.md).
Testy są zaplanowane na bramę zakończenia całego etapu Services.

**Wdrożenie szablonu Add Service (2026-11-14):** commit `b4da49e` i poprawka `291a5ff`. A8 ostatni potwierdzony kod `291a5ff3f1713021e251cb0865cb6f84d481f1ad`, receipt `pockethost-a8-service-creator-symlink-20261114-v1`, `PASS`, PID 9787, HTTP 200, bez zmian chronionych usług, `tests=not-run`. Kreator z wbudowanym, bezpiecznym workerem jest w panelu, ale **nie sprawdzono jeszcze fizycznego stworzenia i uruchomienia takiej usługi**; user-supplied scripts, bezpieczne usuwanie i testy całości są otwarte. Status S1 nadal **IN_PROGRESS**.

**Następny podetap S1/S2 — bezpieczne archiwizowanie workera:** implementacja
`Archive worker` jest ograniczona do usług `heartbeat-worker-v1` utworzonych
i nadal zweryfikowanych przez PocketHost. Wymaga zatrzymania i wyłączenia
autostartu; runit dostaje `sv exit`, a system odpina **wyłącznie** własny
symlink. Definicja i logi pozostają do późniejszego odzyskania. Ogólny
`unregister` w panelu/API jest wycofany — usługi projektów Node i cudze
usługi nie mogą stracić właściciela przez przypadek. To **nie** jest jeszcze
pełne trwałe usuwanie ani przetestowany przepływ. Zakres i scenariusze testów:
[S1 runit reuse](S1_RUNIT_REUSE.md). **Status S1/S2: IN_PROGRESS.**

**Wdrożenie S1/S2 archiwizacji — 2026-11-15:** kod `7c19c3df189518e649a851dc74db17ea04f259fa`, zadanie `pockethost-a8-worker-archive-20261115-v1`, końcowy `PASS`: live SHA `7c19c3df189518e649a851dc74db17ea04f259fa`, PID 19987, HTTP 200, chronione usługi bez zmian, `tests=not-run`. W panelu jest `Archive worker` wyłącznie dla zweryfikowanego, zatrzymanego, bez autostartu workera szablonowego. Usługi Node/SSH/Local Agent nie udostępniają destrukcyjnej operacji; ogólny `unregister` zablokowany. Pliki i logi archiwum pozostają — brak trwałego usuwania, brak odzysku z archiwum i brak zakończenia testów. **Nie zmieniać S1–S6 na `[x]`**.

**Bieżąca implementacja S1 — dwa typy własnego workera:** `Add Service`
dopuszcza teraz ograniczone, wbudowane szablony Node.js i Python.
Oba używają jednej rejestracji runit, kontroli integralności, autostartu,
logów i archiwizacji; nie uruchamiają się automatycznie, dzielą limit
czterech sztuk i nie przyjmują kodu ani komend przez panel LAN. To **nie**
oznacza jeszcze wdrażania dowolnej aplikacji Python/Node z repozytorium.
Rozszerzenie wymaga zatwierdzenia źródła, wersji i uprawnień uruchomienia.
S1 pozostaje **IN_PROGRESS** do czasu testów i akceptacji całego Services.
Szczegóły: [kontrakt i granice](S1_RUNIT_REUSE.md).

**S1/S2 — domknięcie przywracania archiwum (kod, bez odbioru):**
dodano oddzielny prywatny rejestr archiwalnych workerów Node.js/Python,
`Archived workers → Restore service` oraz weryfikację dokładnie tego
samego skryptu głównego i logującego, identyfikatora instancji, ścieżki,
skrótu i pliku `down`. Przywrócenie nie uruchamia usługi ani nie włącza
autostartu. Przerwane operacje pozostają w stanie HOLD, bez automatycznego
przejęcia usług lub ponowień. **Wdrożenie tej i poprzedniej zmiany
Python na A8 nie zostało jeszcze potwierdzone**, więc pełne S1/S2
pozostają `[ ]`. Zgodnie z planem testy funkcjonalne i akceptacja
dopiero po ukończeniu całego etapu Services.

**S1/S2 — odmowa sterowania przy konflikcie archiwizacji (kod, bez odbioru):**
gdy aktywny rejestr i rejestr archiwum wskazują tę samą usługę
(po przerwanym Archive lub Restore), jej stan staje się
`archive-conflict` / `conflict`. Panel wyświetla ostrzeżenie,
wyłącza Start/Stop/Restart/autostart/Restore, a adapter odmawia działania.
Nie ma automatycznego „naprawiania” ani przejmowania obcej usługi.
Scenariusze negatywne zapisano w [S1 runit reuse](S1_RUNIT_REUSE.md).
**Kod na `main` nie jest jeszcze wdrożeniem A8 ani zaliczeniem testów.**
S1/S2 pozostają `[ ]`.

**S3 — zapis i odczyt zwrotny autostartu runit (częściowe, NIE `[x]`):**
backend wywołuje istniejące `sv-enable` / `sv-disable` tylko dla zweryfikowanych
usług, sprawdza wynik, następnie ponownie sprawdza tożsamość jednostki
i faktyczny plik `down`. UI potwierdza sukces dopiero po odczycie z
inwentarza. Zmiana może od razu uruchomić lub zatrzymać proces pod runit,
dlatego panel komunikuje ten efekt. **Termux:Boot i autostart po fizycznym
restarcie Androida pozostają osobnym, jeszcze nieprzetestowanym punktem**.
Nie ma nowego supervisora ani schedulera. Testy S3 na zakończenie Services.

**Definicja DONE:** użytkownik potrafi w panelu zarejestrować własną usługę, uruchomić ją, włączyć autostart, sprawdzić health/logi, bezpiecznie odzyskać po awarii i wyrejestrować; testy i dowody bezpieczeństwa PASS; odbiór zaakceptowany.

## 2. Platform — rzeczywista konfiguracja hosta z panelu

**Status: NOT_STARTED jako pełny etap; część UI/LAN już działa.**

- [ ] **P1 — LAN:** konfiguracja adresu prywatnego Wi-Fi, włączenie/wyłączenie, zapamiętanie polityki startu, status bramy i readback po ponownym starcie; bez WAN i bez publicznych reverse proxy; działające obecnie połączenie MacBooka to częściowy dowód.
- [ ] **P2 — Termux/runit boot:** konfiguracja i diagnoza w panelu, kontrolowane potwierdzenie po prawdziwym restarcie telefonu **tylko za osobną zgodą**.
- [ ] **P3 — SSH:** port, klucze, status, jawny bezpieczny start/stop, kontrola własności i ścieżka odzyskiwania dostępu; istniejący system SSH na A8 pozostaje chroniony dopóki osobno nie zaaprobowano przejęcia.
- [ ] **P4 — Git/GitHub:** repozytoria, dostęp i poświadczenia bez ujawniania sekretów, walidacja dostępu, konfiguracja z UI; bez fałszywych „connected” z demo CMS.
- [ ] **P5 — Bezpieczeństwo i odbiór:** zakresy uprawnień API z LAN bez hasła, walidacje negatywne, testy zmian i odzyskiwania, raport, aktualny panel do odbioru.

**Definicja DONE:** komplet działa z ustawień UI, a nie z ręcznie nadpisanych zmiennych lub twardych reguł. Testy i odbiór są potwierdzone.

## 3. Hosting — pełne flow od projektu do rollbacku

**Status: NOT_STARTED jako pełny etap; istnieją częściowe API i ekrany.**

- [ ] **H1 — Static i Node niezależnie:** tworzenie projektu/strony, walidowany katalog, repozytorium lub pliki, zależności i build z widocznym stanem.
- [ ] **H2 — Wdrożenie i uruchomienie:** wydanie → właściwy runit → readiness → link i podgląd → logi; brak ukrytych project-specific adapterów.
- [ ] **H3 — Aktualizacja i cofnięcie:** nowa wersja → health gate → promocja lub rollback do ostatniej dobrej wersji; dowody procesu, release i portów.
- [ ] **H4 — Bramy funkcji i bezpieczeństwo:** stopniowe odblokowanie istniejących feature-gated Hosting API dopiero po upewnieniu się co do LAN mutations i ownership, bez obcych usług.
- [ ] **H5 — Testy end-to-end i odbiór:** niezależne static/Node, negatywne ścieżki, recover/rollback, raport i panel A8 dla użytkownika.

**Definicja DONE:** Create → Git/import → Build → Deploy → Run → Health → Logs → Update → Rollback przetestowane na zasobach należących do PocketHost.

## 4. Stabilizacja MVP — bezpieczeństwo i gotowość do używania

**Status: NOT_STARTED jako pełny etap.**

- [ ] **M1 — Porządek:** usunąć martwe ścieżki i dublowane mechanizmy; zachować świadomie umieszczone na dole przykłady framework/CMS.
- [ ] **M2 — Backup/restore:** odtwarzalny backup i odtworzenie do izolowanego miejsca, spójne logi i diagnostyka, niezależna kopia poza urządzeniem gdy uzgodniona.
- [ ] **M3 — Testy przekrojowe:** bezpieczeństwo LAN/host, ServiceRegistry/ProjectRegistry, cold-start (tylko za osobną zgodą), awarie, rollback i regresja UX.
- [ ] **M4 — Finalny raport + odbiór MVP:** lista dowodów, pokrycie testów, znane ograniczenia, dokładne SHA uruchomione na A8, link LAN, decyzja właściciela.

## FAST FLOW — obowiązuje dla każdego commitu i ukończonego etapu

1. Odczytaj `AGENTS.md`, `docs/START_HERE.md`, **ten plan**, scoped AGENTS, świeży `main` i rzeczywisty live SHA/owner A8. Kontynuuj **najwyższy nieukończony punkt bieżącego etapu**, zamiast rozpoczynać kolejne szkielety; ewentualny blocker udokumentuj.
2. **Kod na aktualnym `main`**: najmniejsza funkcjonalna pionowa zmiana, istniejące kontrakty, bez powtórnych audytów; jeden spójny commit. Aktualizuj status punktów tylko gdy masz dowód implementacji.
3. **Jedno zadanie Local Agent Samsung A8**: pinned base/target, cached QA checkout, oficjalny `ops/termux/fast-flow.mjs --apply`; bez testów podczas zwykłych iteracji. Nigdy Mac/Codex/Work/GitHub Actions/S22.
4. **Przed i po aktualizacji**: sprawdź owner markers, live SHA, PID/start ticks, chronione usługi, wynik guarded refresh, localhost HTTP i prywatny LAN; nie nadpisuj nieznanego procesu, bez automatycznego retry. FAIL / brak receipt / drift = HOLD.
5. **Zamknięcie pełnego etapu**: na podstawie tej zgody właściciela uruchom **w jednym zatwierdzonym zadaniu A8** fokusowane testy (`--tests` we właściwym kroku FAST FLOW, jeśli wspiera dany zestaw) oraz brakujące bezpieczne testy kontraktu/UI/negatywne/integracyjne. Nie uruchamiaj operacji ryzykownych bez osobnej zgody. Raportuj realną liczbę PASS/FAIL/SKIP, zakres i luki; nie wymyślaj procentu pokrycia.
6. **Oddanie etapu**: przeładuj/wdróż **tylko własny panel A8** zatwierdzoną ścieżką, sprawdź dokładny SHA, HTTP 200, LAN i stan usług; podaj działający URL dla MacBooka i poproś użytkownika o odbiór. Odświeżenie karty MacBooka wykonuje użytkownik. `READY_FOR_ACCEPTANCE` przed potwierdzeniem; `ACCEPTED` i `[x]` dopiero po nim.
7. **Raport i checkpoint**: commit(s), live SHA, urządzenie, wykonany zakres, lista testów/wyniki/pokrycie lub luki, deployment receipt, bezpieczne granice, link LAN, status odbioru i dokładny następny punkt. Zapisz w tym trackerze.

**Żadnych osobnych stałych schedulerów, automatycznych nocnych audytów, fikcyjnych ustawień UI i twardych zależności od hostowanych projektów. Dokumentacja-only: commit na main, bez restartu panelu.**

## Rejestr zakończeń

| Data | Element | Status | Dowód / uwagi |
| --- | --- | --- | --- |
| 2026-11-14 | Baza A8, menu i otwieranie na MacBooku | ACCEPTED (baza) | Właściciel: „ok działa jest ok”; A8 live `e4838cd`, HTTP 200, LAN `healthy`; bez pełnych testów etapów |
| — | Etap 1 Services | IN_PROGRESS | S1–S6 otwarte |
| — | Etap 2 Platform | NOT_STARTED | P1–P5 otwarte |
| — | Etap 3 Hosting | NOT_STARTED | H1–H5 otwarte |
| — | Etap 4 Stabilizacja | NOT_STARTED | M1–M4 otwarte |

**Następny punkt kodowania: S1 — uniwersalny, bezpieczny registry i enrollment usług.**
