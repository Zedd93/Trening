import Link from "next/link";

export const metadata = { title: "O aplikacji i prywatność" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 leading-relaxed">
      <Link href="/" className="text-sm text-muted">
        ← Aplikacja
      </Link>
      <h1 className="mt-3 text-2xl font-bold">SEAL PERFORMANCE — o aplikacji</h1>
      <p className="mt-3 text-muted">
        Aplikacja łączy 4-tygodniowy program Full Body (siła, hipertrofia, elementy tactical fitness i kondycja) z modułem żywieniowym. Jest inspirowana przygotowaniem fizycznym jednostek specjalnych, ale <strong className="text-fg">nie jest oficjalnym programem Navy SEALs</strong> ani produktem powiązanym z U.S. Navy.
      </p>
      <p className="mt-3 text-muted">
        Aplikacja nie jest wyrobem medycznym i nie zastępuje porady lekarza, dietetyka klinicznego ani fizjoterapeuty. Przy chorobach przewlekłych, ciąży, urazach lub przeciwwskazaniach do wysiłku skonsultuj plan ze specjalistą.
      </p>
      <p className="mt-3">
        <Link href="/o-aplikacji/animacje" className="text-olive-strong underline">
          Zobacz wszystkie animowane demonstracje ćwiczeń →
        </Link>
      </p>

      <h2 className="mt-8 text-xl font-semibold">Zasady przetwarzania danych (RODO)</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>
          <strong className="text-fg">Zakres danych:</strong> e-mail i hasło (konto), rok urodzenia, płeć (wyłącznie do wzoru Mifflina-St Jeora), wzrost, masa ciała, opcjonalny obwód pasa, aktywność, preferencje żywieniowe, alergie, opcjonalne opisy urazów i przeciwwskazań, zapisy treningów i posiłków.
        </li>
        <li>
          <strong className="text-fg">Cel i podstawa:</strong> personalizacja planu treningowego i żywieniowego na podstawie wyraźnej zgody udzielanej przy rejestracji (dane o zdrowiu — art. 9 ust. 2 lit. a RODO). Zgodę można wycofać, usuwając konto.
        </li>
        <li>
          <strong className="text-fg">Minimalizacja:</strong> przechowujemy rok urodzenia zamiast pełnej daty; pola o zdrowiu są opcjonalne; brak narzędzi analitycznych, reklam i profilowania marketingowego.
        </li>
        <li>
          <strong className="text-fg">Miejsce przechowywania:</strong> w trybie lokalnym — wyłącznie w przeglądarce na Twoim urządzeniu (IndexedDB). W trybie z kontem Supabase — w bazie PostgreSQL z zasadami Row Level Security, które pozwalają odczytać i zmienić wyłącznie własne rekordy.
        </li>
        <li>
          <strong className="text-fg">Usługi zewnętrzne:</strong> wyszukiwanie w Open Food Facts wysyła tylko wpisaną frazę lub kod kreskowy. Opcjonalny moduł AI wysyła pytanie i podsumowanie danych do Anthropic wyłącznie po włączeniu zgody w Profilu.
        </li>
        <li>
          <strong className="text-fg">Twoje prawa:</strong> dostęp i przenoszenie danych (eksport JSON/CSV w Profilu), sprostowanie (edycja w aplikacji), usunięcie (Profil → Usuń konto i wszystkie dane — trwale, kaskadowo).
        </li>
        <li>
          <strong className="text-fg">Bezpieczeństwo:</strong> hasła w trybie lokalnym jako skrót PBKDF2-SHA256; w Supabase uwierzytelnianie Supabase Auth; klucze serwerowe (service role, klucz AI) nigdy nie trafiają do przeglądarki; nagłówki bezpieczeństwa HTTP.
        </li>
      </ul>
      <p className="mt-6 text-sm text-muted">
        Administratorem danych jest podmiot wdrażający aplikację. Przy wdrożeniu produkcyjnym należy uzupełnić dane kontaktowe administratora, umowę powierzenia z dostawcą hostingu/Supabase oraz rejestr czynności przetwarzania.
      </p>
    </div>
  );
}
