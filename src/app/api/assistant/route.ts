/**
 * Opcjonalny moduł AI asystenta (Claude, Anthropic Messages API).
 *
 * Włączany wyłącznie po stronie serwera zmienną ANTHROPIC_API_KEY — klucz
 * nigdy nie trafia do przeglądarki. Klient wysyła pytanie oraz zwięzłe
 * podsumowanie danych (tylko za zgodą użytkownika w Profilu). Trasa niczego
 * nie zapisuje.
 *
 * Dostęp:
 *  - przy skonfigurowanym Supabase wymagany jest token zalogowanego użytkownika,
 *  - w trybie lokalnym trasa działa tylko przy ASSISTANT_ALLOW_LOCAL=true
 *    (np. prywatne wdrożenie na własnym komputerze).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5-5";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const SYSTEM = `Jesteś asystentem treningowo-żywieniowym aplikacji SEAL PERFORMANCE (trening siłowy Full Body, hipertrofia, kondycja, żywienie sportowe).
Odpowiadasz po polsku, zwięźle i praktycznie, używając jednostek metrycznych i 24-godzinnego formatu czasu.
Opieraj się WYŁĄCZNIE na danych użytkownika przekazanych w sekcji <dane> oraz na aktualnej wiedzy naukowej. Jeżeli danych brakuje lub jest ich za mało, powiedz to wprost i nie zgaduj liczb.
Nie diagnozujesz chorób i nie zastępujesz lekarza, dietetyka klinicznego ani fizjoterapeuty — przy bólu, urazach lub niepokojących objawach zalecasz konsultację.
Nie proponujesz agresywnych deficytów kalorycznych ani nie traktujesz diety low-carb/keto jako z założenia skuteczniejszej przy tej samej podaży energii i białka.
Zmiany kalorii i ciężarów przedstawiasz jako propozycje do zatwierdzenia przez użytkownika, z krótkim uzasadnieniem.`;

const hits = new Map<string, { n: number; reset: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    return false;
  }
  h.n += 1;
  return h.n > 10;
}

async function authorize(req: Request): Promise<{ ok: true; key: string } | { ok: false; status: number; error: string }> {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return { ok: false, status: 401, error: "Wymagane zalogowanie." };
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return { ok: false, status: 401, error: "Nieprawidłowa sesja." };
    return { ok: true, key: data.user.id };
  }
  if (process.env.ASSISTANT_ALLOW_LOCAL === "true") return { ok: true, key: req.headers.get("x-forwarded-for") ?? "local" };
  return { ok: false, status: 403, error: "Moduł AI w trybie lokalnym wymaga ASSISTANT_ALLOW_LOCAL=true." };
}

export async function GET() {
  const enabled = Boolean(process.env.ANTHROPIC_API_KEY) && (Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) || process.env.ASSISTANT_ALLOW_LOCAL === "true");
  return Response.json({ enabled, model: enabled ? MODEL : null });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Moduł AI nie jest skonfigurowany (brak ANTHROPIC_API_KEY na serwerze)." }, { status: 503 });
  const auth = await authorize(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (rateLimited(auth.key)) return Response.json({ error: "Zbyt wiele zapytań — spróbuj za minutę." }, { status: 429 });

  let body: { question?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const context = typeof body.context === "string" ? body.context : "";
  if (!question || question.length > 1000) return Response.json({ error: "Pytanie musi mieć od 1 do 1000 znaków." }, { status: 400 });
  if (context.length > 20_000) return Response.json({ error: "Zbyt duży kontekst danych." }, { status: 413 });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // Przy odmowie ze względów bezpieczeństwa API ponawia zapytanie na modelu zapasowym.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: `<dane>\n${context}\n</dane>\n\nPytanie: ${question}` }],
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ answer: "Nie mogę odpowiedzieć na to pytanie. Spróbuj je przeformułować.", model: response.model });
    }
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return Response.json({ answer: answer || "Brak odpowiedzi.", model: response.model, truncated: response.stop_reason === "max_tokens" });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "Limit zapytań do modelu AI — spróbuj później." }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return Response.json({ error: "Nieprawidłowa konfiguracja klucza API po stronie serwera." }, { status: 503 });
    if (error instanceof Anthropic.BadRequestError) return Response.json({ error: "Model odrzucił zapytanie (błąd żądania)." }, { status: 400 });
    if (error instanceof Anthropic.APIError) return Response.json({ error: `Błąd usługi AI (${error.status ?? "?"}).` }, { status: 502 });
    return Response.json({ error: "Nie udało się połączyć z usługą AI." }, { status: 502 });
  }
}
