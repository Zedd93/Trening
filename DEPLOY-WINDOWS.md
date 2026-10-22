# Wdrożenie na Windows Server (bez Dockera)

Ta instrukcja prowadzi krok po kroku przez uruchomienie aplikacji na Windows Server, z dostępem z internetu i z HTTPS. Docker nie jest potrzebny.

Jak to będzie działać:

```
Internet ──► router/firewall firmy ──► serwer Windows
                                         ├─ Caddy   (porty 80 i 443, robi HTTPS)
                                         └─ Node.js (aplikacja, tylko lokalnie na 127.0.0.1:3000)
```

- **Node.js** uruchamia samą aplikację.
- **Caddy** jest „portierem”: przyjmuje ruch z internetu, sam pobiera darmowy certyfikat HTTPS (Let's Encrypt) i przekazuje ruch do aplikacji.
- Oba programy uruchamia **Harmonogram zadań Windows** przy starcie serwera, więc działają też po restarcie.

Wszystkie komendy wpisujesz w **PowerShell uruchomionym jako administrator**: menu Start → wpisz `PowerShell` → prawy przycisk myszy → *Uruchom jako administrator*.

---

## Krok 1. Sprawdzenie serwera

### 1a. Wersja Windows

```powershell
Get-ComputerInfo -Property WindowsProductName, OsVersion
```

Potrzebny jest **Windows Server 2016 lub nowszy** (OsVersion od 10.0.14393). Na Server 2012 R2 i starszych obecne wersje Node.js nie działają. Wtedy zatrzymaj się i daj znać.

### 1b. Czy porty 80 i 443 są wolne

```powershell
Get-NetTCPConnection -LocalPort 80,443 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalPort, OwningProcess, @{n='Proces';e={(Get-Process -Id $_.OwningProcess).ProcessName}}
```

Jak odczytać wynik:

| Wynik | Co to znaczy | Co dalej |
|---|---|---|
| Nic się nie wyświetla | Porty są wolne | Ścieżka A (Caddy), kroki 2–8 |
| Proces `System` (PID 4) | Porty zajmuje usługa HTTP Windows, zwykle IIS | Uruchom komendę poniżej i wyślij wynik |
| Inna nazwa, np. `httpd`, `nginx`, `caddy`, `java` | Działa już inny serwer WWW | Nie wyłączaj go! Najpierw ustal, do czego służy |

Gdy jest to `System`, sprawdź, czy chodzi o IIS:

```powershell
Get-Service W3SVC -ErrorAction SilentlyContinue
Get-Website -ErrorAction SilentlyContinue | Select-Object Name, State, Bindings
```

Jeśli IIS już obsługuje inne strony firmy, nie da się postawić Caddy na tych samych portach. Wtedy aplikację trzeba podpiąć pod IIS (ścieżka B na końcu tego dokumentu).

### 1c. Jaki serwer ma publiczny adres IP

```powershell
Invoke-RestMethod https://api.ipify.org
```

Zapisz ten adres, będzie potrzebny w kroku 6.

### 1d. Czy Node.js i Git są już zainstalowane

```powershell
node -v
git --version
```

Jeśli pojawi się błąd „nie rozpoznano”, zainstalujesz je w kroku 2.

---

## Krok 2. Instalacja Node.js i Git

1. **Node.js**: wejdź na https://nodejs.org, pobierz wersję **LTS** (plik `.msi`, Windows x64) i zainstaluj ją z domyślnymi opcjami („Next” do końca).
2. **Git**: wejdź na https://git-scm.com/download/win, pobierz instalator 64-bit i zainstaluj z domyślnymi opcjami.
3. **Zamknij PowerShell i otwórz go ponownie jako administrator**, żeby nowe programy były widoczne.
4. Sprawdź instalację: `node -v` powinno pokazać `v22...` lub nowszą wersję, a `git --version` numer wersji Gita.

## Krok 3. Pobranie i zbudowanie aplikacji

```powershell
mkdir C:\apps -Force
cd C:\apps
git clone https://github.com/Zedd93/Trening.git
cd C:\apps\Trening
git checkout claude/keen-archimedes-oiud7x
npm ci
npm run build
```

- `npm ci` instaluje biblioteki i trwa kilka minut.
- `npm run build` buduje aplikację. Na końcu powinna pojawić się lista stron (`/`, `/trening`, `/dieta`...) i żadnego czerwonego `Error`.

Jeśli `git clone` prosi o logowanie, repozytorium jest prywatne. Zaloguj się kontem GitHub, które ma do niego dostęp.

### Test lokalny

```powershell
node node_modules\next\dist\bin\next start -p 3000 -H 127.0.0.1
```

Na serwerze otwórz przeglądarkę i wejdź na `http://localhost:3000`. Powinna pokazać się aplikacja. Pod `localhost` działa też zakładanie konta. Zamknij test przez `Ctrl+C`.

## Krok 4. Automatyczny start aplikacji

Ta komenda tworzy zadanie, które uruchamia aplikację przy starcie serwera i próbuje uruchomić ją ponownie, jeśli zakończy się błędem:

```powershell
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node `
  -Argument 'node_modules\next\dist\bin\next start -p 3000 -H 127.0.0.1' `
  -WorkingDirectory 'C:\apps\Trening'
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'SEAL Performance' -Action $action -Trigger $trigger `
  -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force
Start-ScheduledTask -TaskName 'SEAL Performance'
```

Po około 10 sekundach sprawdź, czy aplikacja odpowiada:

```powershell
(Invoke-WebRequest http://127.0.0.1:3000 -UseBasicParsing).StatusCode
```

Wynik `200` oznacza, że aplikacja działa.

## Krok 5. Domena

Certyfikat HTTPS wystawia się na **nazwę domeny**, a nie na sam adres IP. Potrzebujesz adresu w rodzaju `trening.twojafirma.pl`.

Poproś osobę, która zarządza domeną firmy (albo zaloguj się do panelu u rejestratora, np. home.pl, OVH, nazwa.pl), o dodanie rekordu DNS:

| Typ | Nazwa | Wartość |
|---|---|---|
| `A` | `trening` | publiczny IP z kroku 1c |

Sprawdź po kilku minutach (czasem trwa to do godziny):

```powershell
Resolve-DnsName trening.twojafirma.pl
```

Wynik powinien pokazać ten sam adres IP co w kroku 1c.

## Krok 6. Otwarcie portów 80 i 443

**Zapora Windows** na serwerze:

```powershell
New-NetFirewallRule -DisplayName 'HTTP 80 (Caddy)'   -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName 'HTTPS 443 (Caddy)' -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

**Router lub firewall firmowy**: jeśli serwer stoi za routerem (ma lokalny adres typu `192.168.x.x` albo `10.x.x.x`), administrator sieci musi przekierować porty **80 i 443** z publicznego IP na lokalny adres serwera. Lokalny adres sprawdzisz komendą `ipconfig` (pole „Adres IPv4”).

Port 80 też musi być otwarty, bo Let's Encrypt sprawdza przez niego, że domena należy do Ciebie. Caddy przekierowuje go potem automatycznie na HTTPS.

## Krok 7. Caddy (HTTPS)

1. Wejdź na https://caddyserver.com/download, wybierz **Platform: Windows amd64** i kliknij *Download*.
2. Utwórz folder `C:\caddy` i przenieś do niego pobrany plik. Zmień jego nazwę na `caddy.exe`.
3. Utwórz plik konfiguracyjny. W komendzie **zamień `trening.twojafirma.pl` na swoją domenę**:

```powershell
@'
trening.twojafirma.pl {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
'@ | Set-Content -Encoding ascii C:\caddy\Caddyfile
```

4. Uruchom test ręcznie:

```powershell
cd C:\caddy
.\caddy.exe run --config C:\caddy\Caddyfile
```

Po kilkunastu sekundach w logu powinno pojawić się `certificate obtained successfully`. Otwórz w przeglądarce `https://trening.twojafirma.pl` i sprawdź, czy jest kłódka.

Jeśli pojawia się błąd z `challenge` lub `timeout`, nie działa DNS z kroku 5 albo przekierowanie portów z kroku 6.

5. Zatrzymaj test przez `Ctrl+C` i ustaw automatyczny start Caddy:

```powershell
$action = New-ScheduledTaskAction -Execute 'C:\caddy\caddy.exe' `
  -Argument 'run --config C:\caddy\Caddyfile' -WorkingDirectory 'C:\caddy'
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'Caddy' -Action $action -Trigger $trigger `
  -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force
Start-ScheduledTask -TaskName 'Caddy'
```

## Krok 8. Test końcowy

1. Na telefonie **wyłącz Wi-Fi**, żeby łączyć się z zewnątrz, i otwórz `https://trening.twojafirma.pl`.
2. Załóż konto i przejdź konfigurator.
3. Zrestartuj serwer w dogodnym momencie i sprawdź, czy aplikacja wstała sama.

Gotowe.

---

## Aktualizacja aplikacji

```powershell
cd C:\apps\Trening
Stop-ScheduledTask -TaskName 'SEAL Performance'
git pull
npm ci
npm run build
Start-ScheduledTask -TaskName 'SEAL Performance'
```

## Opcjonalnie: asystent AI i Supabase

Utwórz plik `C:\apps\Trening\.env.local`, wzorując się na `.env.example`. Opis zmiennych jest w `DEPLOY.md`.

- Po zmianie `ANTHROPIC_API_KEY` wystarczy restart zadania `SEAL Performance`.
- Po zmianie `NEXT_PUBLIC_SUPABASE_*` trzeba ponownie uruchomić `npm run build`.
- Aplikacja jest dostępna z internetu, więc **nie ustawiaj** `ASSISTANT_ALLOW_LOCAL=true`. Każdy, kto zna adres, mógłby wtedy korzystać z Twojego klucza API.

## Gdy coś nie działa

| Objaw | Co sprawdzić |
|---|---|
| Zadanie nie startuje | `Get-ScheduledTaskInfo -TaskName 'SEAL Performance'`: pole `LastTaskResult` powinno mieć wartość `0` lub `267009` (zadanie działa) |
| `localhost:3000` nie odpowiada | Uruchom komendę z „Testu lokalnego” w kroku 3 ręcznie i przeczytaj błąd |
| Caddy: `bind: address already in use` | Port 80 lub 443 jest zajęty. Wróć do kroku 1b |
| Caddy: błąd `challenge` lub `timeout` | DNS (krok 5) albo przekierowanie portów (krok 6) |
| Strona działa, ale nie da się założyć konta | Aplikacja jest otwarta przez `http://`, a nie `https://` |

---

## Ścieżka B: porty zajęte przez IIS

Jeśli IIS już obsługuje inne strony, aplikację podpina się pod niego:

1. Zainstaluj dodatki IIS **URL Rewrite** i **Application Request Routing (ARR)** ze strony Microsoft. W ARR włącz *Server Proxy Settings → Enable proxy*.
2. Dodaj w IIS nową witrynę z powiązaniem (binding) na nazwę `trening.twojafirma.pl`.
3. Dodaj w niej regułę URL Rewrite typu *Reverse Proxy* na `127.0.0.1:3000`.
4. Certyfikat HTTPS uzyskasz darmowym narzędziem **win-acme** (https://www.win-acme.com), które samo podpina go do witryny IIS i odnawia.

Kroki 2–6 (Node.js, aplikacja, zadanie, domena, porty) są takie same. Pomijasz tylko Caddy. Konfigurację IIS najlepiej przejść razem. Wyślij mi wynik kroku 1b, a przygotuję dokładne kliknięcia.
