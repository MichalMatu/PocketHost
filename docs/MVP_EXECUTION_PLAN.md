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

**S4 — ręczna obserwacja stanu runit (częściowo, nie DONE):**
strona `Services → Health checks` oferuje teraz odczyt na żądanie
dla usług wyraźnie zweryfikowanych przez PocketHost. Backend
ponownie sprawdza źródło/skrót i rejestr przed oraz po odczycie,
zwraca stan `running/stopped/unknown`, autostart, znacznik
ostatniego zapisu logów (jeśli bezpieczny) i jawne
`readiness: not-verified`. Obcy proces jest odrzucany,
a wpis w logach **nie** oznacza gotowości aplikacji.
Nie dodano schedulera ani samoczynnego restartu. S4 pozostaje `[ ]`:
polityka limitowanych prób, odrębne readiness i recovery są nadal
do implementacji i testów końca całego etapu.

**Wdrożenia 2026-11-15 (A8 FAST FLOW, bez testów etapu):**
S1/S2 `2c2b4e3` — archiwizacja, przywracanie i blokady konfliktów;
S3 `839c397` — trwały odczyt zwrotny stanu autostartu;
S4 `10f469ddb1f60dad89bb1b1a3d1641a50197e8d2` — ręczny odczyt runit/znacznika logu z rozróżnieniem
PID od application readiness. Trzy terminalne wyniki `PASS`,
ostatni live SHA `10f469ddb1f60dad89bb1b1a3d1641a50197e8d2`, PID 29180, HTTP 200, chronione
usługi nietknięte, `tests=not-run`. **Nie jest to zatwierdzenie
funkcjonalne S1–S4**. Następny krok: jawna polityka readiness/recovery
dla zweryfikowanych usług i dopiero po pełnym zamknięciu Services
testy pozytywne/negatywne oraz raport.

**S4 — ręczne, limitowane odzyskiwanie workera (częściowo, bez odbioru):**
strona `Services → Health checks` udostępnia dla w pełni
zweryfikowanych workerów Node.js/Python `Review recovery` oraz
jawne `Request one recovery start`. Reużywamy istniejące
`evaluateHealthPolicy`; wolno uruchomić pojedyncze `sv up` tylko,
gdy worker jest zatrzymany, autostart włączony, nie zmieniła się jego
tożsamość, a limit wynosi **2 żądania w ciągu godziny** z
**2-minutowym cooldownem**. Historia prób jest zapisywana w
prywatnym rejestrze *przed* poleceniem; nieudane lub przerwane
wywołanie zużywa próbę. Przy `running` / `unknown` / `down`
brak naprawy. Brak schedulera, samoczynnych działań, restartów usług
projektów lub dowolnych procesów. **To limit próśb PocketHost, nie
mechanizmu restartów samego runit.** HTTP readiness/rollback
dla ogólnych usług oraz pełne testy etapu pozostają otwarte.

**Wdrożenie ręcznego recovery na A8 — 2026-11-15:** commit `0047af4a455c799086cc5f708b6add8d60462e56`,
zadanie `pockethost-a8-runit-manual-recovery-20261115-v1`, terminalny
`PASS`, live `0047af4a455c799086cc5f708b6add8d60462e56`, PID 28494, HTTP 200,
chronione usługi bez zmian, `tests=not-run`.
Przywracanie gotowości aplikacji nie jest potwierdzone przez samo
`sv up`; limit dotyczy wyłącznie ręcznych prób PocketHost,
nie mechanizmu restartów runit. **Status S1–S4 nadal IN_PROGRESS.**
Następne: konfiguracja readiness, polityka rollback i testy
całego etapu przed odbiorem.

**S4 — konfigurowalny heartbeat własnych workerów (częściowo, bez odbioru):**
`Health checks` obsługuje dla własnych, ponownie zweryfikowanych
szablonów Node.js/Python progi 3/5/10 minut lub Off. Prywatny zapis
polityki jest związany z identyfikatorem konkretnej instancji;
kontrola na żądanie wymaga końcowej linii `svlogd -tt` z ustalonym
tekstem heartbeat oraz świeżego czasu zapisu logu. **To dowód
aktywności workera, nie pełna readiness aplikacji ani HTTP**.
Brak ingerencji w obce serwisy, brak nowych schedulerów, brak
automatycznych restartów; istniejące Node Hosting HTTP readiness
pozostaje odrębnym mechanizmem. S4 nadal `[ ]`: brak jeszcze
konfigurowalnej readiness dowolnej aplikacji, rollback i
kompletnego testu na A8.

**S4 heartbeat — wdrożenie A8 2026-11-15:** commit `b975d1feb7011d24bd592aadc55e1a30d54a0e90`,
zadanie `pockethost-a8-worker-heartbeat-policy-20261115-v1`, terminalny
`PASS`, live SHA `b975d1feb7011d24bd592aadc55e1a30d54a0e90`, PID 27534, HTTP 200, chronione
usługi bez zmian, `tests=not-run`. Zapis progu heartbeat (Off/3/5/10
minut) jest przypisany do instancji workera i odczytywany po zapisie.
Nie potwierdza to gotowości ogólnych aplikacji ani nie kończy S4;
nadal brak pełnej polityki HTTP readiness/rollback i testów S5.

**S4 — odczyt HTTP readiness i historia rollbacku Node Hosting (częściowo):**
`Services → Health checks` pokazuje teraz stan HTTP wyłącznie jako
ręcznie pobraną migawkę z czasem pomiaru, przypisaną do konkretnego
aktywnego wydania; przy zmianie wydania nie odziedziczy starego
`ready`. Osobno pokazuje zapisany identyfikator wcześniejszego dobrego
wydania i link do `Projects`. To **kandydat**, nie gotowość do rollbacku:
sprawdzenie kodu, zależności i uprawnień odbywa się w istniejącej,
ograniczonej do lokalnej konsoli ścieżce Node Hosting. UI nie
udostępnia nowej mutacji ani nie otwiera wcześniejszego
`rollback-preview` na niezabezpieczonym LAN. Nie dodawano
schedulera, sond cyklicznych ani restartów. **S4 nadal `[ ]`**:
pozostają testy całego przepływu i decyzja o polityce readiness
dla innych rodzajów usług.

**S4 HTTP readiness/rollback UI — A8 2026-11-15:** kod `65696ec2de1df8723adb29081d2af9b976377679`;
`pockethost-a8-node-health-rollback-snapshot-20261115-v1` zakończył
`PASS`: live SHA `65696ec2de1df8723adb29081d2af9b976377679`, PID 21351, HTTP 200, usługi
chronione nietknięte, `tests=not-run`. Wynik gotowości to próbka
konkretnego wydania z czasem obserwacji; historyczne `ready` nie
przechodzi na inne wydanie. Kandydat rollbacku jest informacją,
nie autoryzacją — preflight i zapis lokalnie, istniejąca blokada
mutacji przez LAN bez zmian. **S4 i testy S5 nadal otwarte.**

**S4 — blokada równoczesnych żądań recovery (kod, bez odbioru):**
ręczne `recoverWorkerOnce` obejmuje teraz prywatną, wyłączną
blokadą plikową zarówno ponowną kwalifikację workera, jak i trwały
zapis próby przed jedynym `sv up`. Dzięki temu różne instancje panelu
nie mogą jednocześnie przekroczyć limitu 2 prób/godzinę.
Konflikt blokady jest odrzucany, bez automatycznego ponawiania.
Po awarii nieusunięta blokada oznacza HOLD do niezależnej
weryfikacji; nie jest czyszczona automatycznie. Zasady
readiness/rollback i testy zamknięcia Services nadal otwarte;
**S4 pozostaje `[ ]`.**

**S4 A8 2026-11-15 — wzajemne wykluczanie recovery:** kod `db72ddd03240bd589076e44a618e08575745b9bf`,
receipt `pockethost-a8-cross-process-recovery-lock-20261115-v1`,
terminalny `PASS`, live `db72ddd03240bd589076e44a618e08575745b9bf`, PID 17795, start ticks 11979838,
HTTP 200, chronione usługi bez zmian, `tests=not-run`.
Blokada plikowa działa na granicy wielu procesów właściciela:
od odczytu limitu po pojedyncze `sv up`; przerwana blokada zostaje
do niezależnej weryfikacji. **S1–S4 nadal IN_PROGRESS.**
Test współbieżnych żądań dopiero przy bramie odbiorczej Services.

**S1/S2 — granica zarządzania usługami projektów (kod, przed odbiorem):**
wspólny rejestr runit rozróżnia `standalone` (w pełni
zweryfikowany wewnętrzny worker Node/Python), `delegated`
(weryfikowana jednostka zarządzana osobną ścieżką, np. Node Hosting)
i `read-only` (obce/niezweryfikowane/chronione). W Services
Start/Stop/Restart/Autostart i odpowiadające im akcje API przyjmują
wyłącznie `standalone`; projekt Node zachowuje własne bramy wydania,
PID, health, rollback i uprawnienia. Panel pokazuje usługi delegowane
z odnośnikiem do Projects zamiast pozornych przycisków sterowania.
Nie rozszerzono uprawnień przez LAN. **S1/S2 wciąż `[ ]`**:
brak testów etapowych i bezpiecznego pełnego enrollmentu rzeczywistych
usług aplikacji przez użytkownika.

**S1/S2 A8 — granica własności delegowanych usług, 2026-11-15:**
`pockethost-a8-delegated-runit-scope-20261115-v1` — `PASS`, live
`50e5195864157e1069c83019c368edf3753d9078`, PID 16796, start ticks 12137868, HTTP 200, chronione
usługi bez zmian, `tests=not-run`. Runit `standalone` może być
sterowany przez H3 wyłącznie po weryfikacji wzorca; `delegated` jest
widoczny, lecz sterowanie pozostaje w module, który go utworzył.
To nie zastępuje odbioru funkcjonalnego ani enrollmentu dowolnej
aplikacji. S1/S2 pozostają `[ ]`.


**S2 — weryfikacja po wykonaniu polecenia (kod, bez odbioru):**
Start/Stop/Restart/Once teraz wymagają poprawnego wyniku `sv` i ponownego
potwierdzenia ścieżki oraz zapisanej tożsamości usługi po wywołaniu.
Dodatkowo ścieżka ogólnego Services ponownie sprawdza niezmienny
szablon własnego workera (marker, skrypty i logowanie) po wykonaniu.
Wynik `sv` nie oznacza jeszcze osiągnięcia stanu aplikacji ani readiness.
Do bramy testowej S5 dodać odmowę dla niezerowego exit, zmiany źródła
w trakcie polecenia i cofnięcia własności po wywołaniu. **S2 pozostaje
`[ ]` do testów i odbioru.**

**S2 — wdrożenie i odczyt A8, 2026-11-15:** commit `fd171be3f5a532e2a639993f43bc09a6487080e5`; jednorazowe zadanie `pockethost-a8-runit-lifecycle-readback-20261115-v1` — terminalne `done`, `exit_code=0`, FAST FLOW `PASS`, uruchomiony dokładnie SHA `fd171be3f5a532e2a639993f43bc09a6487080e5`, PID 29908, start ticks 16238126, HTTP 200, usługi chronione bez zmian, `tests=not-run`. **S2 i cały etap Services pozostają IN_PROGRESS**; testy pozytywne/negatywne S5 dopiero przy zakończeniu funkcjonalności.

**S1/S2 — blokada współbieżnych operacji workera (kod, przed odbiorem):**
Tworzenie, przywracanie, archiwizacja oraz Start/Stop/Restart/autostart
własnych szablonów korzystają z jednej prywatnej blokady `O_EXCL` między
procesami. Obejmuje ona odczyt, kontrolę pochodzenia, zapis w rejestrach
i polecenie `sv`; przy konflikcie odmawia działania, a po przerwaniu
pozostawia blokadę do ręcznej weryfikacji, bez ponowienia. Nie dotyczy
ścieżki usług projektów Node, która zachowuje odrębne bramy.
Przy zamknięciu Services przetestować dwa równoczesne żądania na różnych
workerach, podwójną rejestrację, konflikt Archive/Restore/Start,
pozostawioną i podmienioną blokadę oraz brak zmian w usługach chronionych.
**S1/S2 nadal `[ ]`, bez testów w tej iteracji.**

**S1/S2 — dostarczenie na A8, 2026-11-15:** kod `0659b5635f3af16b01c55986e1e5754afcf5e20d`, zadanie `pockethost-a8-standalone-lifecycle-lock-20261115-v1`: terminalne `done`, exit 0, `PocketHostFastFlow PASS`, live SHA `0659b5635f3af16b01c55986e1e5754afcf5e20d`, PID 16665, start ticks 16326083, HTTP 200, usługi chronione bez zmian, `tests=not-run`. Blokada współbieżności jest wdrożona, lecz **bez testów funkcjonalnych** i nie zamyka S1/S2 ani Services.

**S2 — odczyt logów z archiwum (kod przed testami):** `Runit services → Archived workers → Saved logs` odczytuje zachowany plik `current` bez przywracania workera, tylko po potwierdzeniu dokładnego wpisu archiwum i niezmienionych prywatnych skryptów/markera. Odczyt ma ograniczenie rozmiaru, symlink/owner/inode check oraz ponowną kontrolę tożsamości po czytaniu. Stan `changed`/`conflict` nie pozwala na odczyt ani restore. Testy negatywne: podmiana markera, link w logach, zniknięcie/przełączenie archiwum w trakcie czytania, brak logu, brak dotykania cudzych usług. **S2 IN_PROGRESS; etap Services nieodebrany.**

**S2 — logi archiwum wdrożone na A8, 2026-11-15:** terminalne zadanie `pockethost-a8-archived-worker-logs-20261115-v1` = `PASS` (live `02d60255ebeb9869b6c56436074d6c1e91c0787e`, PID 4499, start ticks 16424935, HTTP 200, usługi chronione bez zmian, `tests=not-run`). W panelu działa kod do ręcznego odczytu logów zweryfikowanego archiwum bez `Restore`; **niezweryfikowane funkcjonalnie** na utworzonym workerze. Testy pozytywne/negatywne, trwałe bezpieczne wycofanie definicji oraz obsługa własnego kodu aplikacji nadal otwarte. **S1/S2/Services: IN_PROGRESS.**

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
