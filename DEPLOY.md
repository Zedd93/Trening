# Wdrożenie na własnym serwerze

Instrukcja pierwszego uruchomienia SEAL PERFORMANCE na serwerze firmowym (Linux).

## Najważniejsze: aplikacja wymaga HTTPS

Rejestracja i logowanie korzystają z Web Crypto (`crypto.subtle`), a tryb PWA z service workera. Przeglądarki udostępniają oba mechanizmy tylko w **bezpiecznym kontekście**: przez `https://` albo pod `http://localhost`. Jeśli otworzysz aplikację jako `http://192.168.1.10:3000`, strona się wyświetli, ale **zakładanie konta i logowanie nie zadziała**. Dlatego poniższe wdrożenie stawia przed aplikacją Caddy, który obsługuje HTTPS.

## Gdzie są dane

Bez Supabase aplikacja działa w **trybie lokalnym**: konta i wszystkie dane są zapisywane w przeglądarce każdego użytkownika (IndexedDB), nie na serwerze. Serwer tylko serwuje aplikację. Konsekwencje:

- każdy użytkownik ma dane tylko na swoim urządzeniu i w swojej przeglądarce (telefon i komputer nie są synchronizowane),
- wyczyszczenie danych przeglądarki usuwa dane (kopię można zrobić w Profilu → eksport JSON),
- na serwerze nie ma bazy do backupu.

Jeśli kilka osób ma korzystać z aplikacji z różnych urządzeń, skonfiguruj Supabase (sekcja niżej).

## Wymagania

- Linux z Dockerem i wtyczką Compose (`docker compose version`),
- około 2 GB RAM do zbudowania obrazu (sama aplikacja potrzebuje około 150 MB),
- jedna z opcji:
  - **A.** domena (np. `trening.firma.pl`) wskazująca na serwer i porty 80/443 otwarte z internetu, albo
  - **B.** serwer dostępny tylko w sieci firmowej (adres IP albo wewnętrzna nazwa DNS).

## Krok po kroku (Docker)

```bash
# 1. Pobierz kod (aplikacja jest na tej gałęzi, nie na main)
git clone https://github.com/Zedd93/Trening.git
cd Trening
git checkout claude/keen-archimedes-oiud7x

# 2. Konfiguracja
cd deploy
cp .env.example .env
nano .env            # ustaw SITE_ADDRESS
```

### Wariant A: domena publiczna

W `deploy/.env`:

```
SITE_ADDRESS=trening.firma.pl
```

Caddy sam pobierze i będzie odnawiał certyfikat Let's Encrypt.

### Wariant B: tylko sieć firmowa

W `deploy/.env` wpisz adres z prefiksem `https://`:

```
SITE_ADDRESS=https://192.168.1.10
```

W `deploy/Caddyfile` dopisz `tls internal`:

```
{$SITE_ADDRESS} {
	tls internal
	encode zstd gzip
	reverse_proxy app:3000
}
```

Caddy wystawi certyfikat z własnego, lokalnego CA. Przeglądarki pokażą ostrzeżenie, dopóki nie zaufają temu CA. Aby ostrzeżenie zniknęło i działała instalacja PWA, zainstaluj certyfikat główny na komputerach i telefonach użytkowników (albo przez GPO lub MDM w firmie):

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
```

Jeśli firma ma własne CA, możesz zamiast tego podać swój certyfikat: `tls /ścieżka/cert.pem /ścieżka/key.pem`. Pliki trzeba wtedy zamontować w kontenerze `caddy` w `docker-compose.yml`.

### 3. Uruchomienie

```bash
# w katalogu deploy/
docker compose up -d --build
docker compose ps                 # oba kontenery powinny mieć status "running"
docker compose logs -f app        # powinno być "Ready"
```

Otwórz `https://<SITE_ADDRESS>`, załóż konto i przejdź konfigurator.

### Aktualizacja

```bash
git pull
cd deploy && docker compose up -d --build
```

Dane użytkowników w trybie lokalnym są w ich przeglądarkach, więc aktualizacja ich nie dotyka.

## Bez Dockera (Node.js + systemd)

Wymaga Node.js w wersji 20.9 lub nowszej (zalecana 22).

```bash
npm ci
npm run build
PORT=3000 HOSTNAME=127.0.0.1 npm start
```

Przykładowa usługa `/etc/systemd/system/seal-performance.service`:

```ini
[Unit]
Description=SEAL PERFORMANCE
After=network.target

[Service]
WorkingDirectory=/opt/Trening
Environment=NODE_ENV=production PORT=3000 HOSTNAME=127.0.0.1
EnvironmentFile=-/opt/Trening/.env.local
ExecStart=/usr/bin/npm start
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now seal-performance
```

Przed aplikacją postaw reverse proxy z HTTPS (Caddy, nginx, IIS/ARR itp.) kierujące ruch na `127.0.0.1:3000`. Bez HTTPS nie zadziała logowanie.

## Opcjonalnie: Supabase (wielu użytkowników, synchronizacja)

1. Utwórz projekt na supabase.com (albo self-hosted Supabase) i w SQL Editor uruchom `supabase/migrations/0001_init.sql`.
2. W `deploy/.env` ustaw `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API). Nigdy nie wpisuj klucza `service_role`.
3. Przebuduj obraz: `docker compose up -d --build`. Te zmienne są wkompilowywane w kod przeglądarki, więc sam restart nie wystarczy.
4. W Supabase (Authentication → URL Configuration) ustaw Site URL na adres aplikacji.

Tryb Supabase nie był testowany na żywej bazie (patrz README), więc po włączeniu sprawdź rejestrację, logowanie i zapis treningu.

## Opcjonalnie: asystent AI

W `deploy/.env` ustaw `ANTHROPIC_API_KEY`. W trybie lokalnym (bez Supabase) trasa AI jest dodatkowo zablokowana, dopóki nie ustawisz `ASSISTANT_ALLOW_LOCAL=true`. Zrób to tylko wtedy, gdy aplikacja nie jest dostępna z internetu, bo każdy, kto otworzy stronę, mógłby wtedy korzystać z Twojego klucza API (limit to 10 zapytań na minutę). Te zmienne działają po `docker compose up -d`, bez przebudowy.

## Rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| Strona działa, ale rejestracja lub logowanie nic nie robi albo zgłasza błąd | Aplikacja jest otwarta przez `http://` pod adresem innym niż localhost. Użyj HTTPS. |
| `docker compose` zgłasza „Ustaw SITE_ADDRESS” | Brak pliku `deploy/.env` albo pusta wartość `SITE_ADDRESS`. |
| Caddy nie pobiera certyfikatu (wariant A) | Domena nie wskazuje na serwer albo porty 80/443 są zablokowane z internetu. Dla sieci wewnętrznej użyj wariantu B. |
| Porty 80/443 są zajęte | Na serwerze działa już inny serwer WWW. Wyłącz go albo skieruj w nim ruch na kontener aplikacji i usuń usługę `caddy` z compose. |
| Po aktualizacji widać starą wersję | Service worker trzyma stare pliki. Odśwież stronę dwukrotnie albo zamknij wszystkie karty aplikacji. |
| Build przerywa się z błędem pamięci | Za mało RAM. Dodaj swap albo zbuduj obraz na innej maszynie i przenieś go (`docker save` / `docker load`). |
