---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Milestones ordered by canonical MVP acceptance tracker
---

# PocketHost roadmap

**Jedyny bieżący plan z checklistami, dowodami i statusem odbioru: [MVP execution plan](MVP_EXECUTION_PLAN.md).** Ten roadmap nie jest drugą listą zadań.

0. **Zaakceptowana baza — 2026-11-14:** PocketHost działa na A8 (runit/watch), na MacBooku po prywatnym LAN; menu jest uporządkowane, przykłady framework/CMS pozostają na dole. Ostatni potwierdzony SHA `e4838cd472a0db57bf0760ae2a384a97035fdc94`. Nie oznacza to ukończenia funkcji Hosting/Services/Platform ani ich testów.
1. **Services — IN_PROGRESS:** uniwersalny rejestr i bezpieczna własność, lifecycle/logi, autostart, readiness, ograniczony recovery; po domknięciu wszystkie testy zakresu, raport i odbiór.
2. **Platform — NOT_STARTED jako kompletny etap:** konfiguracja LAN i boot, SSH i Git/GitHub, zabezpieczenia, testy i odbiór. Reboot tylko na osobną zgodę.
3. **Hosting — NOT_STARTED jako kompletny etap:** niezależne Node i static, Create → import Git/files → Build → Deploy → Run → Health → Logs → Update → Rollback; testy i odbiór.
4. **Stabilizacja MVP — NOT_STARTED:** porządki, bezpieczeństwo, backup/restore, regresja, raport i odbiór końcowy; zachowaj demonstracyjne strony frameworka.

**Szybkie flow:** bieżący main → spójny commit → jedno strzeżone zadanie A8 Local Agent FAST FLOW → exact-SHA/owner/HTTP/LAN readback. Testy skupione na **ukończeniu pełnego etapu**, zgodnie z wyraźną zgodą właściciela; nie podczas zwykłej implementacji. Dokumentacja-only nie uruchamia panelu. Bez dodatkowego schedulera, Mac/Codex/Work/GitHub Actions, S22 lub automatycznych ponowień.

**Po zaakceptowanym MVP:** wielokomponentowe projekty, poświadczenia i magazyny, domeny/HTTPS, powtarzalny instalator Termux, opcjonalne rozszerzenia Android; migracja niezależnego Local Agent tylko z oddzielnym operatorem i zgodą.

PocketHost jest uniwersalnym koordynatorem jawnie zarejestrowanych usług; runit jest procesowym supervisorem, obce usługi pozostają chronione do potwierdzonego przejęcia.
