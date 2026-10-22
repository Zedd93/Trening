# SEAL PERFORMANCE

Aplikacja webowa PWA łącząca **4-tygodniowy program treningowy Full Body** (siła, hipertrofia, elementy tactical fitness, kondycja) z **modułem żywieniowym** (kalkulator, dziennik, jadłospisy, lista zakupów, meal prep) oraz **analizą łączącą oba obszary** (trend masy, adaptacyjne TDEE, raport tygodniowy, ochrona masy mięśniowej).

> Inspirowana przygotowaniem fizycznym jednostek specjalnych. **Nie jest** oficjalnym programem Navy SEALs ani produktem U.S. Navy. Nie zastępuje porady lekarza ani dietetyka.

## Szybki start

```bash
npm install
npm run dev          # http://localhost:3000
```

Bez dodatkowej konfiguracji aplikacja działa w **trybie lokalnym**: konta i dane są zapisywane w przeglądarce (IndexedDB), hasła jako skrót PBKDF2-SHA256. Dane przetrwają zamknięcie aplikacji.

Build produkcyjny: `npm run build && npm start`.

Wdrożenie na własnym serwerze (Docker + HTTPS): **[DEPLOY.md](DEPLOY.md)**.

## Stos

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zustand · IndexedDB (`idb`) · Supabase (PostgreSQL + Auth + RLS) · Recharts · własny silnik animacji SVG · Vitest · Playwright · opcjonalnie `@anthropic-ai/sdk` (asystent AI).

## Funkcje

| Obszar | Co działa |
|---|---|
| Konfigurator | 7 kroków: dane, aktywność i sporty, sprzęt, urazy/przeciwwskazania, cele (z priorytetem), preferencje żywieniowe, podsumowanie z podglądem planu |
| Trening | 12 spersonalizowanych sesji (A STRENGTH / B TACTICAL FUNCTIONAL / C HYPERTROPHY), dobór ćwiczeń do sprzętu i urazów, dopasowanie do czasu, objętość tygodniowa per partia, kalendarz ↔ lista, przenoszenie z kontrolą regeneracji, pomijanie, licznik czasu z pauzą, timer odpoczynku (przetrwa zamknięcie aplikacji), timer interwałów, notatki, zamiana ćwiczeń, historia, kolejny cykl / kopia planu |
| Animacje | 57 ćwiczeń, każde z własną animacją SVG (szkielet z kinematyką prostą i odwrotną, sprzęt, pętla, pauza, restart, `prefers-reduced-motion`); podgląd wszystkich: `/o-aplikacji/animacje` |
| Progresja | Kalibracja e1RM po tygodniu 1, progresja powtórzeń, wzrost ciężaru po spełnieniu warunków, konsolidacja/deload w tygodniu 4; uwzględnia powtórzenia, ciężary, RIR, technikę, sRPE, regenerację, zmęczenie, przerwy i pominięte treningi. Każda rekomendacja ma uzasadnienie i wymaga akceptacji |
| Żywienie | BMR (Mifflin-St Jeor), TDEE z kroków/pracy/treningów/sportów (liczone raz), umiarkowany deficyt/nadwyżka, makro (standard, high protein, low carb, indywidualny), białko od masy referencyjnej przy BMI ≥ 30, kaloryczność stała lub zmienna z zachowaniem średniej tygodniowej |
| Dziennik | Konfigurowalne posiłki + przekąski, g/ml/szt./porcja/łyżeczka/łyżka (z przeliczeniem), edycja i usuwanie, zamienniki z przeliczeniem gramatury, kopiowanie dnia, nawodnienie (150/250/500/własne) |
| Produkty | Baza generyczna ze źródłem przy każdej pozycji, Open Food Facts (wyszukiwanie + kod kreskowy, skaner `BarcodeDetector`), produkty z etykiety z kontrolą spójności kcal |
| Przepisy | Składniki z gramaturą, masa gotowej potrawy, wartości na 100 g i porcję, ulubione, dodawanie porcji jednym kliknięciem |
| Jadłospis | 1 / 7 / 28 dni, dopasowanie makro (ważone najmniejsze kwadraty po rolach składników), alergie, wykluczenia, styl, czas, budżet, ulubione, powtarzalność, gotowanie na zapas, blokowanie posiłków, zamiana posiłku i składnika, eksport CSV/druk |
| Zakupy / meal prep | Sumowanie i grupowanie, odhaczanie, „mam w domu”, pozycje ręczne, udostępnianie/eksport; zbiorcza instrukcja gotowania z czasem, pojemnikami, sprzętem i zasadami przechowywania |
| Integracja | Pulpit (dzień/tydzień/cykl), wykresy, adaptacyjne TDEE z oceną jakości danych i propozycją korekty do zatwierdzenia, alerty ochrony masy mięśniowej, raport tygodniowy z archiwum |
| Asystent | Asystent danych (reguły na Twoich zapisach, offline) + opcjonalny moduł AI (Claude) po stronie serwera, za zgodą |
| Inne | Eksport JSON/CSV i przywracanie kopii, usuwanie konta, przypomnienia (za zgodą), motyw ciemny/jasny, PWA (instalacja, praca offline) |

## Architektura

```
src/
  app/                 trasy (Pulpit, Trening, Dieta, Postępy, Profil, Asystent, API AI)
  components/          UI, animacje ćwiczeń, wykresy, komponenty modułów
  lib/
    domain/types.ts    model danych (pola = kolumny SQL)
    data/              adaptery: IndexedDB, Supabase, offline-first sync; auth; store
    training/          ćwiczenia, szkielet i animacje, generator, progresja, harmonogram
    nutrition/         produkty, kalkulator, jednostki, posiłki, planer, zakupy, meal prep, OFF
    analytics/         trendy, adaptacyjne TDEE, raport tygodniowy, alerty
    assistant/         asystent danych
    actions/           operacje domenowe zapisujące do store
supabase/migrations/   schemat SQL z RLS
tests/unit, tests/e2e  Vitest i Playwright
```

Warstwa danych jest niezależna od backendu: ten sam rekord (snake_case) trafia do IndexedDB lub do tabeli PostgreSQL. Wartości planowane (`workout_exercises`, `meal_plan_entries`, `nutrition_targets`) są oddzielone od wykonanych (`exercise_sets`, `food_log_entries`, `body_measurements`). Cele żywieniowe są wersjonowane (historia zmian).

## Supabase (wielu użytkowników, synchronizacja)

1. Utwórz projekt Supabase i uruchom `supabase/migrations/0001_init.sql` (SQL Editor lub `supabase db push`).
2. Ustaw w `.env.local` (patrz `.env.example`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
3. Uruchom aplikację — logowanie przejdzie na Supabase Auth, dane będą zapisywane offline-first (IndexedDB + kolejka synchronizacji).

Bezpieczeństwo: RLS na każdej tabeli (`auth.uid() = user_id`), wyzwalacze blokujące podpięcie rekordu pod cudzy rekord nadrzędny, kaskadowe usuwanie przez `delete_my_account()`. Klucz `service_role` nie jest używany i nie może trafić do klienta.

## Asystent AI (opcjonalnie)

Moduł korzysta z Claude przez `@anthropic-ai/sdk` wyłącznie po stronie serwera (`/api/assistant`):

```
ANTHROPIC_API_KEY=...
ASSISTANT_MODEL=claude-opus-5-5        # domyślnie
ASSISTANT_ALLOW_LOCAL=true             # tylko dla prywatnego wdrożenia bez Supabase
```

Przy Supabase trasa wymaga tokenu zalogowanego użytkownika; ma limit 10 zapytań/min. Włączony jest serwerowy fallback modelu przy odmowie (`fallbacks: "default"`). Bez klucza aplikacja pokazuje, że moduł nie jest skonfigurowany — odpowiedzi AI nie są symulowane. Użytkownik musi wyrazić zgodę w Profilu, zanim podsumowanie jego danych zostanie wysłane.

## Testy

```bash
npm test                     # 123 testy jednostkowe (obliczenia, progresja, planer, izolacja danych, odtworzenie sesji, animacje)
npm run test:e2e             # testy akceptacyjne Playwright (build + start na porcie 3100)
CHROMIUM_PATH=/ścieżka/do/chrome npm run test:e2e   # gdy Playwright nie ma własnej przeglądarki
npm run typecheck
```

Testy E2E pokrywają wymagania akceptacyjne: profil i preferencje, 12 treningów, odtwarzanie i pauza animacji, zapis ciężaru/powtórzeń/RIR, odzyskanie sesji po przeładowaniu, rekomendację progresji, kalkulator, dodanie i edycję posiłku z przeliczeniem kalorii, jadłospis zgodny z alergiami i stylem, listę zakupów, pomiar masy, raport tygodniowy, eksport danych, izolację użytkowników i widok mobilny.

Test animacji sprawdza dla każdej klatki osiągalność celów kinematyki odwrotnej, mieszczenie sylwetki w kadrze i brak przenikania przez podłoże, a także unikalność sekwencji ruchu.

## Ograniczenia i uczciwe zastrzeżenia

- **Wartości odżywcze produktów generycznych** to zaokrąglone wartości referencyjne (USDA FoodData Central SR Legacy, tabele IŻŻ) — źródło jest zapisane przy każdym produkcie; dla konkretnych produktów należy korzystać z etykiety lub Open Food Facts. Ceny produktów służą tylko do orientacyjnej oceny budżetu.
- **Zdjęcia posiłków** zastąpiono ilustracjami talerza generowanymi z faktycznych składników i gramatur — zamiast przypadkowych zdjęć stockowych, które mogłyby nie odpowiadać potrawie.
- **Przypomnienia** działają, gdy aplikacja jest uruchomiona (także jako zainstalowana PWA w tle). Powiadomienia przy całkowicie zamkniętej aplikacji wymagają serwera Web Push (VAPID) — architektura (service worker z obsługą kliknięć) jest gotowa na jego dodanie.
- **Tryb Supabase** jest zaimplementowany (adapter, synchronizacja, schemat z RLS), ale w środowisku, w którym powstała aplikacja, nie było instancji Supabase — migracja SQL i adapter nie zostały uruchomione na żywej bazie. Testy automatyczne obejmują tryb lokalny.
- **Offline**: działają odwiedzone wcześniej ekrany; dane są zawsze dostępne lokalnie.
- Skaner kodów kreskowych wymaga przeglądarki z `BarcodeDetector` (Chrome/Edge na Androidzie); w pozostałych kod wpisuje się ręcznie.
