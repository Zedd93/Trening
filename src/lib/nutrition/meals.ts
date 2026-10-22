/**
 * Szablony posiłków do generatora jadłospisów. Gramatury bazowe są punktem
 * wyjścia — generator skaluje składniki według ról (białko / węglowodany /
 * tłuszcz) tak, aby trafić w cel kaloryczny i makroskładniki posiłku.
 */
import type { PlanIngredient } from "@/lib/domain/types";

export type SlotType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealTemplate {
  id: string;
  name: string;
  slots: SlotType[];
  ingredients: PlanIngredient[];
  prep_minutes: number;
  /** Nadaje się do gotowania na zapas */
  batch: boolean;
  /** Maks. dni przechowywania w lodówce po ugotowaniu */
  fridge_days: number;
  mediterranean?: boolean;
  instructions: string[];
}

const I = (product_id: string, grams: number, role: PlanIngredient["role"]): PlanIngredient => ({ product_id, grams, role });

export const MEAL_TEMPLATES: MealTemplate[] = [
  /* ------------------------------ śniadania ------------------------------ */
  {
    id: "m_oat_protein",
    name: "Owsianka białkowa z bananem i borówkami",
    slots: ["breakfast", "snack"],
    ingredients: [I("gen_oats", 60, "carb"), I("gen_milk_2", 200, "fixed"), I("gen_whey", 25, "protein"), I("gen_banana", 80, "carb"), I("gen_blueberries", 60, "veg"), I("gen_peanut_butter", 12, "fat")],
    prep_minutes: 8,
    batch: false,
    fridge_days: 1,
    instructions: ["Zagotuj płatki z mlekiem (3–4 min, mieszając).", "Zdejmij z ognia, wmieszaj odżywkę białkową.", "Dodaj pokrojonego banana, borówki i masło orzechowe."],
  },
  {
    id: "m_scrambled_eggs",
    name: "Jajecznica z pomidorami i pieczywem żytnim",
    slots: ["breakfast", "dinner"],
    ingredients: [I("gen_egg", 150, "protein"), I("gen_egg_white", 60, "protein"), I("gen_rye_bread", 70, "carb"), I("gen_tomato", 150, "veg"), I("gen_butter", 5, "fat")],
    prep_minutes: 10,
    batch: false,
    fridge_days: 1,
    instructions: ["Rozpuść masło na patelni na średnim ogniu.", "Wlej roztrzepane jajka i białka, mieszaj do ścięcia.", "Podawaj z pokrojonym pomidorem i pieczywem."],
  },
  {
    id: "m_skyr_bowl",
    name: "Miska skyr z płatkami, malinami i migdałami",
    slots: ["breakfast", "snack"],
    ingredients: [I("gen_skyr", 250, "protein"), I("gen_oats", 40, "carb"), I("gen_raspberries", 100, "veg"), I("gen_almonds", 15, "fat"), I("gen_honey", 8, "fixed")],
    prep_minutes: 4,
    batch: false,
    fridge_days: 1,
    instructions: ["Przełóż skyr do miski.", "Posyp płatkami, malinami i posiekanymi migdałami, polej miodem."],
  },
  {
    id: "m_quark_veg_bread",
    name: "Twarożek z warzywami i pieczywem",
    slots: ["breakfast", "dinner"],
    ingredients: [I("gen_quark_semi", 150, "protein"), I("gen_yogurt_2", 50, "fixed"), I("gen_cucumber", 100, "veg"), I("gen_red_pepper", 80, "veg"), I("gen_rye_bread", 80, "carb"), I("gen_pumpkin_seeds", 10, "fat")],
    prep_minutes: 8,
    batch: false,
    fridge_days: 2,
    instructions: ["Rozgnieć twaróg z jogurtem, dopraw solą i pieprzem.", "Dodaj pokrojone warzywa i pestki dyni.", "Podawaj z pieczywem."],
  },
  {
    id: "m_spinach_omelette",
    name: "Omlet ze szpinakiem i serem",
    slots: ["breakfast", "dinner"],
    ingredients: [I("gen_egg", 150, "protein"), I("gen_egg_white", 100, "protein"), I("gen_spinach", 60, "veg"), I("gen_gouda", 20, "fat"), I("gen_rye_bread", 50, "carb"), I("gen_rapeseed_oil", 5, "fat")],
    prep_minutes: 12,
    batch: false,
    fridge_days: 1,
    instructions: ["Roztrzep jajka z białkami.", "Na rozgrzanym oleju zeszklij szpinak, wlej masę jajeczną.", "Posyp startym serem, smaż pod przykryciem 3–4 min.", "Podawaj z pieczywem."],
  },
  {
    id: "m_avocado_toast",
    name: "Tosty z awokado i jajkiem",
    slots: ["breakfast"],
    ingredients: [I("gen_rye_bread", 80, "carb"), I("gen_avocado", 60, "fat"), I("gen_egg", 100, "protein"), I("gen_egg_white", 60, "protein"), I("gen_tomato", 100, "veg")],
    prep_minutes: 12,
    batch: false,
    fridge_days: 1,
    mediterranean: true,
    instructions: ["Ugotuj jajka (8 min) lub usmaż na suchej patelni z białkami.", "Rozgnieć awokado z solą i sokiem z cytryny.", "Posmaruj pieczywo, ułóż jajka i pomidora."],
  },
  {
    id: "m_oat_pancakes",
    name: "Placki owsiane z jogurtem skyr i truskawkami",
    slots: ["breakfast"],
    ingredients: [I("gen_oats", 60, "carb"), I("gen_egg", 50, "protein"), I("gen_egg_white", 100, "protein"), I("gen_skyr", 150, "protein"), I("gen_strawberries", 120, "veg"), I("gen_rapeseed_oil", 5, "fat")],
    prep_minutes: 20,
    batch: false,
    fridge_days: 2,
    instructions: ["Zmiksuj płatki z jajkiem i białkami na gładką masę.", "Smaż małe placki na lekko natłuszczonej patelni po 2 min z każdej strony.", "Podawaj ze skyrem i truskawkami."],
  },
  {
    id: "m_tofu_scramble",
    name: "Tofucznica z papryką i szpinakiem",
    slots: ["breakfast", "dinner"],
    ingredients: [I("gen_tofu", 180, "protein"), I("gen_red_pepper", 80, "veg"), I("gen_onion", 40, "veg"), I("gen_spinach", 40, "veg"), I("gen_rapeseed_oil", 8, "fat"), I("gen_rye_bread", 70, "carb")],
    prep_minutes: 12,
    batch: false,
    fridge_days: 2,
    instructions: ["Zeszklij cebulę i paprykę na oleju.", "Dodaj rozkruszone tofu, dopraw kurkumą, solą i pieprzem.", "Na koniec wmieszaj szpinak, podawaj z pieczywem."],
  },
  {
    id: "m_cottage_fruit",
    name: "Serek wiejski z jabłkiem, płatkami i orzechami",
    slots: ["breakfast", "snack"],
    ingredients: [I("gen_cottage", 200, "protein"), I("gen_apple", 150, "carb"), I("gen_oats", 30, "carb"), I("gen_walnuts", 12, "fat")],
    prep_minutes: 4,
    batch: false,
    fridge_days: 1,
    instructions: ["Pokrój jabłko w kostkę.", "Wymieszaj z serkiem, płatkami i orzechami, dopraw cynamonem."],
  },
  {
    id: "m_tuna_sandwich",
    name: "Kanapki z pastą z tuńczyka",
    slots: ["breakfast", "dinner"],
    ingredients: [I("gen_tuna_water", 100, "protein"), I("gen_yogurt_2", 40, "fixed"), I("gen_rye_bread", 90, "carb"), I("gen_cucumber", 100, "veg"), I("gen_olive_oil", 5, "fat")],
    prep_minutes: 7,
    batch: false,
    fridge_days: 1,
    instructions: ["Rozgnieć tuńczyka z jogurtem i oliwą, dopraw.", "Nałóż na pieczywo, dodaj plasterki ogórka."],
  },
  /* -------------------------------- obiady -------------------------------- */
  {
    id: "m_chicken_rice_broccoli",
    name: "Kurczak z ryżem i brokułem",
    slots: ["lunch", "dinner"],
    ingredients: [I("gen_chicken_breast", 150, "protein"), I("gen_rice_white", 70, "carb"), I("gen_broccoli", 200, "veg"), I("gen_olive_oil", 10, "fat")],
    prep_minutes: 25,
    batch: true,
    fridge_days: 3,
    instructions: ["Ugotuj ryż (ok. 12–15 min).", "Kurczaka pokrój, dopraw i upiecz w 200°C ok. 18–22 min (do 75°C w środku) lub usmaż.", "Brokuł ugotuj na parze 5–6 min.", "Skrop oliwą przed podaniem."],
  },
  {
    id: "m_turkey_buckwheat",
    name: "Indyk z kaszą gryczaną i warzywami",
    slots: ["lunch"],
    ingredients: [I("gen_turkey_breast", 150, "protein"), I("gen_buckwheat", 70, "carb"), I("gen_zucchini", 150, "veg"), I("gen_red_pepper", 100, "veg"), I("gen_rapeseed_oil", 10, "fat")],
    prep_minutes: 30,
    batch: true,
    fridge_days: 3,
    instructions: ["Ugotuj kaszę (ok. 15 min).", "Indyka pokrój w kostkę i podsmaż na oleju.", "Dodaj pokrojoną cukinię i paprykę, duś 8–10 min.", "Podawaj z kaszą."],
  },
  {
    id: "m_salmon_potatoes",
    name: "Łosoś z ziemniakami i fasolką szparagową",
    slots: ["lunch", "dinner"],
    ingredients: [I("gen_salmon", 130, "protein"), I("gen_potato", 300, "carb"), I("gen_green_beans", 150, "veg"), I("gen_olive_oil", 5, "fat")],
    prep_minutes: 30,
    batch: false,
    fridge_days: 2,
    mediterranean: true,
    instructions: ["Ugotuj ziemniaki (20 min).", "Łososia dopraw i piecz w 200°C ok. 12–15 min.", "Fasolkę gotuj 6–8 min, skrop oliwą."],
  },
  {
    id: "m_bolognese",
    name: "Makaron pełnoziarnisty po bolońsku",
    slots: ["lunch"],
    ingredients: [I("gen_beef_mince_5", 130, "protein"), I("gen_pasta_ww", 80, "carb"), I("gen_passata", 200, "fixed"), I("gen_onion", 50, "veg"), I("gen_carrot", 60, "veg"), I("gen_olive_oil", 8, "fat")],
    prep_minutes: 30,
    batch: true,
    fridge_days: 3,
    mediterranean: true,
    instructions: ["Zeszklij cebulę i startą marchew na oliwie.", "Dodaj mięso, smaż do zrumienienia.", "Wlej passatę, duś 15 min, dopraw ziołami.", "Podawaj z ugotowanym makaronem."],
  },
  {
    id: "m_chili",
    name: "Chili con carne z ryżem",
    slots: ["lunch"],
    ingredients: [I("gen_beef_mince_5", 120, "protein"), I("gen_kidney_beans", 120, "carb"), I("gen_rice_white", 50, "carb"), I("gen_passata", 150, "fixed"), I("gen_red_pepper", 100, "veg"), I("gen_onion", 50, "veg"), I("gen_rapeseed_oil", 8, "fat")],
    prep_minutes: 35,
    batch: true,
    fridge_days: 3,
    instructions: ["Podsmaż cebulę i mięso na oleju.", "Dodaj paprykę, przyprawy (kumin, papryka wędzona, chili).", "Wlej passatę, dodaj fasolę i duś 15 min.", "Podawaj z ryżem."],
  },
  {
    id: "m_cod_millet",
    name: "Dorsz z kaszą jaglaną, marchewką i groszkiem",
    slots: ["lunch", "dinner"],
    ingredients: [I("gen_cod", 180, "protein"), I("gen_millet", 70, "carb"), I("gen_carrot", 100, "veg"), I("gen_peas", 80, "veg"), I("gen_rapeseed_oil", 10, "fat")],
    prep_minutes: 25,
    batch: false,
    fridge_days: 2,
    instructions: ["Kaszę przepłucz wrzątkiem i ugotuj (15 min).", "Dorsza dopraw i upiecz w 190°C ok. 15 min.", "Marchew i groszek ugotuj na parze, skrop olejem."],
  },
  {
    id: "m_chickpea_curry",
    name: "Curry z ciecierzycą i tofu z ryżem",
    slots: ["lunch"],
    ingredients: [I("gen_chickpeas_can", 150, "protein"), I("gen_tofu", 100, "protein"), I("gen_rice_white", 60, "carb"), I("gen_spinach", 80, "veg"), I("gen_passata", 100, "fixed"), I("gen_onion", 50, "veg"), I("gen_rapeseed_oil", 10, "fat")],
    prep_minutes: 30,
    batch: true,
    fridge_days: 3,
    instructions: ["Zeszklij cebulę z pastą/przyprawą curry na oleju.", "Dodaj passatę, ciecierzycę i tofu w kostce, duś 10 min.", "Na koniec wmieszaj szpinak.", "Podawaj z ryżem."],
  },
  {
    id: "m_turkey_goulash",
    name: "Gulasz z indyka z ziemniakami",
    slots: ["lunch"],
    ingredients: [I("gen_turkey_breast", 150, "protein"), I("gen_potato", 300, "carb"), I("gen_red_pepper", 100, "veg"), I("gen_onion", 50, "veg"), I("gen_passata", 100, "fixed"), I("gen_rapeseed_oil", 8, "fat")],
    prep_minutes: 40,
    batch: true,
    fridge_days: 3,
    instructions: ["Indyka pokrój w kostkę, obsmaż na oleju z cebulą.", "Dodaj paprykę i passatę, duś 20 min.", "Podawaj z ugotowanymi ziemniakami."],
  },
  {
    id: "m_tuna_pasta",
    name: "Makaron z tuńczykiem, pomidorami i szpinakiem",
    slots: ["lunch", "dinner"],
    ingredients: [I("gen_pasta", 80, "carb"), I("gen_tuna_water", 100, "protein"), I("gen_tomato", 150, "veg"), I("gen_spinach", 50, "veg"), I("gen_olive_oil", 10, "fat")],
    prep_minutes: 15,
    batch: false,
    fridge_days: 2,
    mediterranean: true,
    instructions: ["Ugotuj makaron al dente.", "Na oliwie podgrzej pomidory i szpinak, dodaj tuńczyka.", "Wymieszaj z makaronem, dopraw czosnkiem i bazylią."],
  },
  {
    id: "m_pork_sweet_potato",
    name: "Schab pieczony z batatami i kapustą kiszoną",
    slots: ["lunch"],
    ingredients: [I("gen_pork_loin", 150, "protein"), I("gen_sweet_potato", 250, "carb"), I("gen_sauerkraut", 120, "veg"), I("gen_carrot", 60, "veg"), I("gen_rapeseed_oil", 10, "fat")],
    prep_minutes: 40,
    batch: true,
    fridge_days: 3,
    instructions: ["Schab dopraw i piecz w 190°C ok. 30 min (do 70°C w środku).", "Bataty pokrój w kliny, skrop olejem i piecz obok 25–30 min.", "Kapustę wymieszaj ze startą marchwią."],
  },
  {
    id: "m_lentil_dal",
    name: "Dal z czerwonej soczewicy z ryżem",
    slots: ["lunch"],
    ingredients: [I("gen_lentils_red", 80, "protein"), I("gen_rice_white", 50, "carb"), I("gen_carrot", 80, "veg"), I("gen_onion", 50, "veg"), I("gen_passata", 150, "fixed"), I("gen_spinach", 50, "veg"), I("gen_rapeseed_oil", 10, "fat")],
    prep_minutes: 30,
    batch: true,
    fridge_days: 3,
    instructions: ["Zeszklij cebulę i marchew z przyprawami (kurkuma, kumin, imbir).", "Dodaj soczewicę, passatę i 300 ml wody, gotuj 15–18 min.", "Wmieszaj szpinak. Podawaj z ryżem."],
  },
  {
    id: "m_chicken_bulgur",
    name: "Kurczak z bulgurem i warzywami po śródziemnomorsku",
    slots: ["lunch", "dinner"],
    ingredients: [I("gen_chicken_breast", 150, "protein"), I("gen_bulgur", 70, "carb"), I("gen_zucchini", 120, "veg"), I("gen_tomato", 120, "veg"), I("gen_olive_oil", 10, "fat")],
    prep_minutes: 25,
    batch: true,
    fridge_days: 3,
    mediterranean: true,
    instructions: ["Bulgur zalej wrzątkiem (1:2), odstaw na 15 min.", "Kurczaka dopraw oregano i usmaż lub upiecz.", "Cukinię grilluj, pomidory pokrój. Skrop oliwą."],
  },
  {
    id: "m_shrimp_pasta",
    name: "Makaron z krewetkami i cukinią",
    slots: ["lunch", "dinner"],
    ingredients: [I("gen_shrimp", 150, "protein"), I("gen_pasta", 80, "carb"), I("gen_zucchini", 150, "veg"), I("gen_olive_oil", 10, "fat")],
    prep_minutes: 20,
    batch: false,
    fridge_days: 1,
    mediterranean: true,
    instructions: ["Ugotuj makaron.", "Na oliwie z czosnkiem podsmaż cukinię, dodaj krewetki (2–3 min).", "Wymieszaj z makaronem, dopraw cytryną i natką."],
  },
  {
    id: "m_quinoa_tofu_bowl",
    name: "Bowl z quinoa, tofu i warzywami",
    slots: ["lunch", "dinner"],
    ingredients: [I("gen_quinoa", 70, "carb"), I("gen_tofu", 150, "protein"), I("gen_broccoli", 120, "veg"), I("gen_red_pepper", 80, "veg"), I("gen_soy_sauce", 15, "fixed"), I("gen_rapeseed_oil", 8, "fat")],
    prep_minutes: 25,
    batch: true,
    fridge_days: 3,
    instructions: ["Ugotuj przepłukaną quinoę (12–15 min).", "Tofu pokrój w kostkę, upiecz lub usmaż na złoto.", "Warzywa ugotuj na parze, wszystko skrop sosem sojowym."],
  },
  {
    id: "m_eggs_potatoes_kraut",
    name: "Jajka sadzone z ziemniakami i kapustą kiszoną",
    slots: ["lunch", "dinner"],
    ingredients: [I("gen_egg", 150, "protein"), I("gen_skyr", 100, "protein"), I("gen_potato", 300, "carb"), I("gen_sauerkraut", 150, "veg"), I("gen_butter", 5, "fat")],
    prep_minutes: 25,
    batch: false,
    fridge_days: 1,
    instructions: ["Ugotuj ziemniaki.", "Usmaż jajka na maśle.", "Podawaj z kapustą kiszoną i skyrem z koperkiem jako sosem."],
  },
  /* -------------------------------- kolacje ------------------------------- */
  {
    id: "m_chicken_avocado_salad",
    name: "Sałatka z kurczakiem i awokado",
    slots: ["dinner", "lunch"],
    ingredients: [I("gen_chicken_breast", 130, "protein"), I("gen_lettuce", 100, "veg"), I("gen_tomato", 100, "veg"), I("gen_cucumber", 100, "veg"), I("gen_avocado", 60, "fat"), I("gen_olive_oil", 5, "fat"), I("gen_wheat_bread", 40, "carb")],
    prep_minutes: 20,
    batch: false,
    fridge_days: 1,
    mediterranean: true,
    instructions: ["Kurczaka usmaż lub upiecz, pokrój w paski.", "Wymieszaj sałatę, pomidora, ogórka i awokado.", "Polej oliwą z cytryną, podawaj z pieczywem."],
  },
  {
    id: "m_veg_omelette",
    name: "Omlet z pieczarkami i papryką",
    slots: ["dinner", "breakfast"],
    ingredients: [I("gen_egg", 150, "protein"), I("gen_egg_white", 100, "protein"), I("gen_red_pepper", 80, "veg"), I("gen_mushrooms", 80, "veg"), I("gen_gouda", 20, "fat"), I("gen_rapeseed_oil", 5, "fat"), I("gen_rye_bread", 35, "carb")],
    prep_minutes: 15,
    batch: false,
    fridge_days: 1,
    instructions: ["Podsmaż pieczarki i paprykę na oleju.", "Zalej roztrzepanymi jajkami, posyp serem.", "Smaż pod przykryciem do ścięcia."],
  },
  {
    id: "m_chicken_wrap",
    name: "Wrap z kurczakiem i warzywami",
    slots: ["dinner", "lunch"],
    ingredients: [I("gen_tortilla", 60, "carb"), I("gen_chicken_breast", 120, "protein"), I("gen_lettuce", 40, "veg"), I("gen_tomato", 80, "veg"), I("gen_red_pepper", 50, "veg"), I("gen_yogurt_2", 40, "fixed"), I("gen_olive_oil", 5, "fat")],
    prep_minutes: 15,
    batch: false,
    fridge_days: 1,
    instructions: ["Kurczaka usmaż na oliwie i pokrój w paski.", "Jogurt dopraw czosnkiem i ziołami.", "Na tortilli ułóż warzywa, kurczaka i sos, zawiń."],
  },
  {
    id: "m_nicoise",
    name: "Sałatka nicejska z tuńczykiem i jajkiem",
    slots: ["dinner", "lunch"],
    ingredients: [I("gen_tuna_water", 100, "protein"), I("gen_egg", 50, "protein"), I("gen_potato", 200, "carb"), I("gen_green_beans", 100, "veg"), I("gen_tomato", 80, "veg"), I("gen_olive_oil", 10, "fat")],
    prep_minutes: 25,
    batch: false,
    fridge_days: 2,
    mediterranean: true,
    instructions: ["Ugotuj ziemniaki, jajko (9 min) i fasolkę.", "Wystudź, pokrój i ułóż z pomidorem i tuńczykiem.", "Polej oliwą z musztardą i cytryną."],
  },
  {
    id: "m_salmon_veg",
    name: "Pieczony łosoś z brokułem i kalafiorem",
    slots: ["dinner"],
    ingredients: [I("gen_salmon", 130, "protein"), I("gen_broccoli", 150, "veg"), I("gen_cauliflower", 150, "veg"), I("gen_olive_oil", 5, "fat"), I("gen_potato", 120, "carb")],
    prep_minutes: 25,
    batch: false,
    fridge_days: 2,
    mediterranean: true,
    instructions: ["Warzywa i ziemniaki pokrój, skrop oliwą, piecz w 200°C 20 min.", "Dołóż łososia na ostatnie 12–15 min.", "Dopraw cytryną i koperkiem."],
  },
  {
    id: "m_hummus_plate",
    name: "Talerz: serek wiejski, hummus, warzywa i pieczywo",
    slots: ["dinner"],
    ingredients: [I("gen_cottage", 200, "protein"), I("gen_hummus", 60, "fat"), I("gen_rye_bread", 70, "carb"), I("gen_cucumber", 100, "veg"), I("gen_red_pepper", 100, "veg"), I("gen_carrot", 80, "veg")],
    prep_minutes: 8,
    batch: false,
    fridge_days: 2,
    instructions: ["Pokrój warzywa w słupki.", "Podawaj z hummusem, serkiem wiejskim i pieczywem."],
  },
  {
    id: "m_egg_quark_paste",
    name: "Pasta jajeczno-twarogowa na pieczywie",
    slots: ["dinner", "breakfast"],
    ingredients: [I("gen_egg", 100, "protein"), I("gen_quark_semi", 100, "protein"), I("gen_yogurt_2", 30, "fixed"), I("gen_rye_bread", 70, "carb"), I("gen_tomato", 120, "veg"), I("gen_butter", 3, "fat")],
    prep_minutes: 15,
    batch: false,
    fridge_days: 2,
    instructions: ["Ugotuj jajka na twardo (10 min), ostudź.", "Rozgnieć z twarogiem i jogurtem, dopraw szczypiorkiem.", "Podawaj na pieczywie z pomidorem."],
  },
  /* ------------------------------- przekąski ------------------------------ */
  {
    id: "m_skyr_berries",
    name: "Skyr z borówkami",
    slots: ["snack"],
    ingredients: [I("gen_skyr", 200, "protein"), I("gen_blueberries", 100, "carb")],
    prep_minutes: 2,
    batch: false,
    fridge_days: 1,
    instructions: ["Wymieszaj skyr z owocami."],
  },
  {
    id: "m_protein_shake",
    name: "Koktajl białkowy z bananem",
    slots: ["snack", "breakfast"],
    ingredients: [I("gen_whey", 30, "protein"), I("gen_milk_2", 300, "fixed"), I("gen_banana", 100, "carb"), I("gen_peanut_butter", 10, "fat")],
    prep_minutes: 3,
    batch: false,
    fridge_days: 1,
    instructions: ["Zmiksuj wszystkie składniki na gładko."],
  },
  {
    id: "m_rice_cakes_pb",
    name: "Wafle ryżowe z masłem orzechowym i bananem",
    slots: ["snack"],
    ingredients: [I("gen_rice_cakes", 30, "carb"), I("gen_peanut_butter", 20, "fat"), I("gen_banana", 80, "carb"), I("gen_skyr", 150, "protein")],
    prep_minutes: 3,
    batch: false,
    fridge_days: 1,
    instructions: ["Posmaruj wafle masłem orzechowym, ułóż plasterki banana.", "Skyr zjedz obok jako źródło białka."],
  },
  {
    id: "m_yogurt_apple_nuts",
    name: "Jogurt naturalny z jabłkiem i orzechami",
    slots: ["snack"],
    ingredients: [I("gen_yogurt_2", 250, "protein"), I("gen_whey", 15, "protein"), I("gen_apple", 150, "carb"), I("gen_walnuts", 15, "fat")],
    prep_minutes: 4,
    batch: false,
    fridge_days: 1,
    instructions: ["Wymieszaj jogurt z odżywką, dodaj pokrojone jabłko i orzechy."],
  },
  {
    id: "m_kefir_raspberry",
    name: "Koktajl kefirowy z malinami",
    slots: ["snack"],
    ingredients: [I("gen_kefir", 400, "protein"), I("gen_raspberries", 100, "carb"), I("gen_flaxseed", 10, "fat")],
    prep_minutes: 3,
    batch: false,
    fridge_days: 1,
    instructions: ["Zmiksuj kefir z malinami i siemieniem lnianym."],
  },
  {
    id: "m_cottage_tomato",
    name: "Serek wiejski z pomidorem i pieczywem",
    slots: ["snack", "dinner"],
    ingredients: [I("gen_cottage", 200, "protein"), I("gen_tomato", 150, "veg"), I("gen_rye_bread", 35, "carb")],
    prep_minutes: 3,
    batch: false,
    fridge_days: 1,
    instructions: ["Pokrój pomidora, podawaj z serkiem i kromką pieczywa."],
  },
  {
    id: "m_boiled_eggs_veg",
    name: "Jajka na twardo z warzywami",
    slots: ["snack"],
    ingredients: [I("gen_egg", 100, "protein"), I("gen_cucumber", 100, "veg"), I("gen_red_pepper", 100, "veg"), I("gen_rice_cakes", 10, "carb")],
    prep_minutes: 12,
    batch: true,
    fridge_days: 3,
    instructions: ["Ugotuj jajka (10 min), ostudź w zimnej wodzie.", "Podawaj z pokrojonymi warzywami."],
  },
  {
    id: "m_hummus_carrot",
    name: "Hummus z marchewką i wafelkiem",
    slots: ["snack"],
    ingredients: [I("gen_hummus", 60, "fat"), I("gen_carrot", 150, "veg"), I("gen_rice_cakes", 20, "carb"), I("gen_skyr", 150, "protein")],
    prep_minutes: 4,
    batch: false,
    fridge_days: 2,
    instructions: ["Pokrój marchew w słupki, podawaj z hummusem i waflami.", "Skyr jako dodatek białkowy."],
  },
  {
    id: "m_fruit_almonds",
    name: "Jabłko, migdały i skyr",
    slots: ["snack"],
    ingredients: [I("gen_apple", 180, "carb"), I("gen_almonds", 20, "fat"), I("gen_skyr", 150, "protein")],
    prep_minutes: 2,
    batch: false,
    fridge_days: 1,
    instructions: ["Gotowa przekąska do zabrania."],
  },
];

export const MEAL_MAP: Record<string, MealTemplate> = Object.fromEntries(MEAL_TEMPLATES.map((m) => [m.id, m]));

export const SLOT_LABELS: Record<SlotType, string> = { breakfast: "Śniadanie", lunch: "Obiad", dinner: "Kolacja", snack: "Przekąska" };

/** Typy slotów i udział energii dla danej liczby posiłków. */
export function slotLayout(mealsPerDay: number): { type: SlotType; share: number }[] {
  switch (mealsPerDay) {
    case 2:
      return [
        { type: "lunch", share: 0.5 },
        { type: "dinner", share: 0.5 },
      ];
    case 3:
      return [
        { type: "breakfast", share: 0.3 },
        { type: "lunch", share: 0.4 },
        { type: "dinner", share: 0.3 },
      ];
    case 4:
      return [
        { type: "breakfast", share: 0.25 },
        { type: "lunch", share: 0.35 },
        { type: "snack", share: 0.15 },
        { type: "dinner", share: 0.25 },
      ];
    case 6:
      return [
        { type: "breakfast", share: 0.22 },
        { type: "snack", share: 0.1 },
        { type: "lunch", share: 0.28 },
        { type: "snack", share: 0.1 },
        { type: "dinner", share: 0.22 },
        { type: "snack", share: 0.08 },
      ];
    default:
      return [
        { type: "breakfast", share: 0.25 },
        { type: "snack", share: 0.1 },
        { type: "lunch", share: 0.3 },
        { type: "snack", share: 0.1 },
        { type: "dinner", share: 0.25 },
      ];
  }
}

export function defaultMealNames(mealsPerDay: number): string[] {
  const map: Record<number, string[]> = {
    2: ["Obiad", "Kolacja"],
    3: ["Śniadanie", "Obiad", "Kolacja"],
    4: ["Śniadanie", "Obiad", "Podwieczorek", "Kolacja"],
    5: ["Śniadanie", "Drugie śniadanie", "Obiad", "Podwieczorek", "Kolacja"],
    6: ["Śniadanie", "Drugie śniadanie", "Obiad", "Podwieczorek", "Kolacja", "Przekąska"],
  };
  return map[mealsPerDay] ?? map[5];
}
