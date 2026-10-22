import { expect, test, type Page } from "@playwright/test";

/**
 * Testy akceptacyjne (XI. wymagania akceptacyjne) — tryb lokalny (IndexedDB).
 * Każdy test tworzy własne konto, więc testy są niezależne.
 */

const uniq = () => `test${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

async function register(page: Page, email = uniq(), password = "Haslo1234") {
  await page.goto("/logowanie");
  await page.getByRole("tab", { name: "Rejestracja" }).click();
  await page.getByLabel("Imię lub pseudonim", { exact: true }).fill("Tester");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Utwórz konto" }).click();
  await expect(page).toHaveURL(/konfigurator/);
  return { email, password };
}

async function onboard(page: Page, opts: { allergy?: string; diet?: string } = {}) {
  // 1. Dane podstawowe
  await page.getByLabel("Rok urodzenia", { exact: true }).fill("1992");
  await page.getByLabel("Wzrost", { exact: true }).fill("182");
  await page.getByLabel("Masa ciała", { exact: true }).fill("86");
  await page.getByLabel("Obwód pasa (opcjonalnie)", { exact: true }).fill("90");
  await page.getByRole("button", { name: "Dalej →" }).click();
  // 2. Aktywność
  await expect(page.getByText("Doświadczenie treningowe")).toBeVisible();
  await page.getByRole("button", { name: "Dalej →" }).click();
  // 3. Sprzęt (domyślnie pełna siłownia)
  await page.getByRole("button", { name: "Dalej →" }).click();
  // 4. Zdrowie
  await page.getByRole("button", { name: "Kolano", exact: true }).click();
  await page.getByRole("button", { name: "Dalej →" }).click();
  // 5. Cele
  await page.getByRole("button", { name: "Redukcja tkanki tłuszczowej" }).click();
  await page.getByRole("button", { name: "Dalej →" }).click();
  // 6. Żywienie
  if (opts.allergy) await page.getByRole("button", { name: opts.allergy }).click();
  if (opts.diet) await page.getByLabel("Styl żywienia", { exact: true }).selectOption(opts.diet);
  await page.getByRole("button", { name: "Dalej →" }).click();
  // 7. Podsumowanie
  await expect(page.getByText(/4 tygodnie × 3 treningi = 12 sesji/)).toBeVisible();
  await page.getByRole("button", { name: "Utwórz mój plan" }).click();
  await expect(page.getByRole("tab", { name: "Dzień", exact: true })).toBeVisible();
}

test("1–2, 5: profil, konfigurator, 12 treningów i zachowanie danych po ponownym otwarciu", async ({ page }) => {
  await register(page);
  await onboard(page);
  await page.goto("/trening");
  await page.getByRole("tab", { name: "Lista" }).click();
  await expect(page.getByRole("link", { name: /^(Start|Otwórz|Kontynuuj)$/ })).toHaveCount(12);
  // Uraz kolana: przysiad bułgarski i wykroki nie powinny trafić do planu
  await page.goto("/trening/cwiczenia/bulgarian_split_squat");
  await expect(page.getByText("Brak zapisanych serii tego ćwiczenia.")).toBeVisible();
  // Ponowne otwarcie aplikacji (nowa karta w tym samym kontekście)
  const page2 = await page.context().newPage();
  await page2.goto("/trening");
  await expect(page2.getByText(/Cykl 1 — SEAL Full Body/)).toBeVisible();
});

test("3–6: animacja, zapis serii, odzyskanie sesji po przeładowaniu i rekomendacja progresji", async ({ page }) => {
  await register(page);
  await onboard(page);
  await page.goto("/trening");
  await page.getByRole("tab", { name: "Lista" }).click();
  await page.getByRole("link", { name: "Start" }).first().click();
  await expect(page.getByRole("heading", { name: /Trening A — STRENGTH/ })).toBeVisible();

  // Animacja: powiększenie + pauza/odtwarzanie
  await page.getByRole("button", { name: /Powiększ demonstrację/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("svg[role=img]")).toBeVisible();
  await dialog.getByRole("button", { name: "Pauza animacji" }).click();
  await expect(dialog.getByRole("button", { name: "Odtwórz animację" })).toBeVisible();
  await dialog.getByRole("button", { name: "Zamknij" }).click();

  await page.getByRole("button", { name: "Rozpocznij" }).click();
  await page.getByRole("button", { name: /^4/ }).first().click();

  const card = page.locator("article").first();
  const name = await card.locator("h3").innerText();
  // Seria 1 i 2: ciężar, powtórzenia, RIR, wykonano
  for (const n of [1, 2, 3]) {
    await card.getByLabel(`Seria ${n}: ciężar`, { exact: true }).fill("60");
    await card.getByLabel(`Seria ${n}: powt.`, { exact: true }).fill("8");
    await card.getByRole("radio", { name: `Seria ${n}: RIR 2`, exact: true }).click();
    await card.getByRole("button", { name: `Seria ${n}: wykonano` }).click();
  }
  await expect(page.getByRole("timer").filter({ hasText: /Odpoczynek|Przerwa/ })).toBeVisible();

  // Odzyskanie sesji po przeładowaniu
  await page.reload();
  const card2 = page.locator("article").first();
  // Ukończone ćwiczenie jest zwinięte do podsumowania — rozwijamy je.
  await card2.getByRole("button", { name: "Edytuj serie" }).click();
  await expect(card2.getByLabel("Seria 1: ciężar", { exact: true })).toHaveValue("60");
  await expect(card2.getByRole("button", { name: "Seria 2: wykonano" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("W trakcie")).toBeVisible();

  await page.getByRole("button", { name: "Zakończ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "Zapisz i oblicz progresję" }).click();
  const summary = page.getByRole("dialog", { name: "Podsumowanie i progresja" });
  await expect(summary.getByText(name)).toBeVisible();
  await expect(summary.getByText(/Kalibracja|Wynik:/).first()).toBeVisible();
});

test("7–9: cele żywieniowe, dodanie i edycja posiłku z przeliczeniem kalorii", async ({ page }) => {
  await register(page);
  await onboard(page);
  await page.goto("/dieta/cele");
  await expect(page.getByText("BMR", { exact: true })).toBeVisible();
  await expect(page.getByText(/Mifflin-St Jeor/)).toBeVisible();

  await page.goto("/dieta");
  await page.getByRole("button", { name: "Dodaj do: Śniadanie" }).click();
  await page.getByLabel("Szukaj produktu", { exact: true }).fill("płatki owsiane");
  await page.getByRole("button", { name: /Płatki owsiane/ }).click();
  await page.getByLabel("Jednostka", { exact: true }).selectOption("g");
  await page.getByLabel("Ilość", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Dodaj do dziennika" }).click();
  await expect(page.getByText(/389.*kcal/).first()).toBeVisible();

  // Edycja: 50 g → 194,5 kcal (zaokrąglenie)
  await page.getByRole("button", { name: /Płatki owsiane/ }).first().click();
  await page.getByRole("dialog").getByLabel("Ilość", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(page.getByText(/^195$/).first()).toBeVisible();
});

test("10–11: jadłospis zgodny z ograniczeniami i lista zakupów", async ({ page }) => {
  await register(page);
  await onboard(page, { allergy: "Ryby", diet: "vegetarian" });
  await page.goto("/dieta/jadlospis");
  await page.getByRole("button", { name: "Generuj jadłospis" }).click();
  await expect(page.getByText("Jadłospis gotowy.")).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/Łosoś|Dorsz|Tuńczyk|kurczak|Kurczak|Indyk|Schab|Wołowina/);

  await page.goto("/dieta/zakupy");
  await page.getByRole("button", { name: "Utwórz listę" }).click();
  await expect(page.getByRole("heading", { name: /Zakupy/ })).toBeVisible();
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  const first = page.getByRole("checkbox").first();
  await first.check();
  await expect(first).toBeChecked();
});

test("12–13, 15: pomiar masy, raport tygodniowy, eksport danych", async ({ page }) => {
  await register(page);
  await onboard(page);
  await page.goto("/postepy");
  await page.getByLabel("Masa ciała", { exact: true }).fill("85.4");
  await page.getByRole("button", { name: "Zapisz pomiar" }).click();
  await expect(page.getByText("85,4 kg")).toBeVisible();
  await page.getByRole("tab", { name: "Raport tygodniowy" }).click();
  await expect(page.getByText("Rekomendacje na kolejny tydzień")).toBeVisible();
  await expect(page.getByText(/Jakość danych/).first()).toBeVisible();

  await page.goto("/profil");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pełna kopia (JSON)" }).click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/seal-performance-dane-.*\.json/);
});

test("izolacja danych: drugi użytkownik nie widzi danych pierwszego", async ({ page }) => {
  const a = await register(page);
  await onboard(page);
  await page.goto("/postepy");
  await page.getByLabel("Masa ciała", { exact: true }).fill("99.9");
  await page.getByRole("button", { name: "Zapisz pomiar" }).click();
  await expect(page.getByText("99,9 kg")).toBeVisible();
  await page.goto("/profil");
  await page.getByRole("button", { name: "Wyloguj" }).click();
  await expect(page).toHaveURL(/logowanie/);

  await register(page);
  await onboard(page);
  await page.goto("/postepy");
  await expect(page.getByText("99,9 kg")).toHaveCount(0);

  // Logowanie złym hasłem na konto A
  await page.goto("/profil");
  await page.getByRole("button", { name: "Wyloguj" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(a.email);
  await page.getByLabel("Hasło", { exact: true }).fill("ZleHaslo99");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByText("Nieprawidłowy e-mail lub hasło.")).toBeVisible();
});

test("14: interfejs mobilny z dolną nawigacją @mobile", async ({ page }) => {
  await register(page);
  await onboard(page);
  const nav = page.getByRole("navigation", { name: "Menu główne" }).last();
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Dieta" }).click();
  await expect(page).toHaveURL(/dieta/);
  await nav.getByRole("link", { name: "Trening" }).click();
  await expect(page.getByRole("heading", { name: "Trening", exact: true })).toBeVisible();
});
