/**
 * constants/medicalIntents.js
 *
 * Phase 6.3 — Intent-Based Medical Rule Engine data.
 *
 * Pure data only, same convention as constants/ruleEngineData.js.
 *
 * Purpose: once the top-level rule engine (ruleEngineData.js) has already
 * matched a MESSAGE to a CATEGORY (e.g. "PCOS"), this file lets
 * chatService.js narrow further to a specific INTENT within that category
 * (e.g. "Diet" vs "Symptoms" vs "Treatment") and return a more specific
 * reply — without ever calling the AI.
 *
 * Shape:
 *   {
 *     "<Category Name — must exactly match a `category` value
 *        used in ruleEngineData.js>": [
 *       {
 *         intent: string,        // human-readable label
 *         keywords: string[],    // lowercase substrings matched against
 *                                // the user's lowercased message
 *         reply: string,         // specialized reply for this intent
 *       },
 *       ...
 *     ],
 *   }
 *
 * Categories not listed here (Emergency, Greeting) have no sub-intents —
 * Emergency must never be narrowed or delayed by intent matching, and
 * Greeting has no medical content to specialize.
 *
 * Every reply follows the same medical-safety rules as the rest of the
 * rule engine: no diagnosis, no prescribing, a doctor-consultation nudge
 * where appropriate, and a clear educational framing.
 */

export const INTENTS = {
  // ─────────────────────────────────────────────
  // PERIODS
  // ─────────────────────────────────────────────
  Periods: [
    {
      intent: "Symptoms",
      keywords: ["symptom", "symptoms", "what causes period", "signs of period"],
      reply:
        "🌸 Common period symptoms include cramping, bloating, fatigue, breast tenderness, mood changes, and lower back pain in the days before and during your period. These are usually normal, but sudden or unusually severe symptoms are worth mentioning to a doctor. This is educational information, not a diagnosis.",
    },
    {
      intent: "Cramps",
      keywords: ["cramp", "cramps", "cramping"],
      reply:
        "🌸 Period cramps are caused by the uterus contracting to shed its lining. A heating pad, gentle stretching, staying hydrated, and over-the-counter pain relief (used as directed on the label) often help. If cramps are severe enough to disrupt daily life, please see a doctor — it could point to something like endometriosis that's worth checking.",
    },
    {
      intent: "Heavy Bleeding",
      keywords: ["heavy flow", "heavy bleeding", "soaking through", "clots", "heavy period"],
      reply:
        "🌸 Bleeding that soaks through a pad or tampon every hour for several hours, includes large clots, or lasts more than 7 days is considered heavy and is worth discussing with a doctor — it can have several underlying causes that are best assessed in person. This is general information, not a diagnosis.",
    },
    {
      intent: "Missed / Late Period",
      keywords: ["missed period", "late period", "no period", "period is late", "skipped my period"],
      reply:
        "🌸 A missed or late period can be caused by stress, significant weight changes, intense exercise, hormonal birth control, pregnancy, or conditions like PCOS or thyroid issues. If it's unexpected, a home pregnancy test can help rule that out, and a doctor can look into other causes if it continues.",
    },
    {
      intent: "Irregular Period",
      keywords: ["irregular period", "irregular cycle", "unpredictable period"],
      reply:
        "🌸 Cycles that vary a lot in length or timing can happen occasionally due to stress or lifestyle changes, but if it's a consistent pattern it's worth getting checked — conditions like PCOS or thyroid imbalances are common, treatable causes. A doctor can help identify what's behind it.",
    },
    {
      intent: "Hygiene",
      keywords: ["hygiene", "how often change pad", "how often change tampon", "menstrual cup", "period hygiene"],
      reply:
        "🌸 Change pads every 4–6 hours and tampons every 4–8 hours (never longer than 8, to reduce infection risk). Wash hands before and after, and change hygiene products more often on heavier days. Menstrual cups can be worn longer per manufacturer instructions. If you notice unusual odor, itching, or irritation, check in with a doctor.",
    },
    {
      intent: "Pain Relief",
      keywords: ["pain relief", "relieve period pain", "ease cramps", "reduce period pain"],
      reply:
        "🌸 A heating pad on the lower abdomen, gentle movement or yoga, staying hydrated, and over-the-counter pain relief taken as directed on the label are common ways to ease period pain. If pain regularly interferes with daily life, please talk to a doctor rather than just managing around it long-term.",
    },
  ],

  // ─────────────────────────────────────────────
  // PCOS
  // ─────────────────────────────────────────────
  PCOS: [
    {
      intent: "Symptoms",
      keywords: ["pcos symptom", "symptoms of pcos", "signs of pcos"],
      reply:
        "🌼 PCOS symptoms can include irregular periods, excess facial/body hair, acne, weight gain, and thinning scalp hair, though it varies a lot between people. Having one or two of these doesn't confirm PCOS — a doctor can properly evaluate and diagnose it.",
    },
    {
      intent: "Causes",
      keywords: ["causes of pcos", "why do i have pcos", "what causes pcos"],
      reply:
        "🌼 PCOS is linked to hormonal imbalances, particularly higher androgen levels and insulin resistance, and it often runs in families. The exact cause isn't fully understood, and it's not caused by anything you did — a doctor can help you understand your specific case.",
    },
    {
      intent: "Diagnosis",
      keywords: ["diagnose pcos", "diagnosis", "do i have pcos", "test for pcos"],
      reply:
        "🌼 PCOS is typically diagnosed by a doctor using a combination of symptom history, blood tests (hormone levels), and sometimes an ultrasound. I can't diagnose PCOS for you — if you suspect it, a gynecologist or endocrinologist is the right person to confirm it properly.",
    },
    {
      intent: "Treatment",
      keywords: ["pcos treatment", "treat pcos", "cure pcos", "manage pcos"],
      reply:
        "🌼 PCOS management is usually personalized — it can include lifestyle changes (diet, exercise), medication to regulate cycles or manage symptoms, or fertility treatment if relevant, depending on your goals. Please work with a doctor to build a plan suited to you; I can't recommend specific medications.",
    },
    {
      intent: "Diet",
      keywords: ["pcos diet", "what to eat for pcos", "pcos food", "pcos nutrition"],
      reply:
        "🌼 Many people with PCOS find it helpful to focus on fiber-rich whole foods, lean protein, and lower-glycemic carbs to help manage insulin resistance, while limiting heavily processed and sugary foods. A dietitian familiar with PCOS can tailor this further to you.",
    },
    {
      intent: "Exercise",
      keywords: ["pcos exercise", "workout for pcos", "pcos fitness"],
      reply:
        "🌼 Regular movement — a mix of cardio and strength training a few times a week — can help improve insulin sensitivity and support hormone balance in PCOS. Even a brisk 30-minute daily walk has been shown to help with symptoms for many people.",
    },
    {
      intent: "Weight Gain",
      keywords: ["pcos weight gain", "pcos weight", "why am i gaining weight pcos"],
      reply:
        "🌼 Weight gain in PCOS is often linked to insulin resistance, which can make weight management harder even with normal eating habits — it's not simply about willpower. A doctor or dietitian can help with an approach that accounts for the hormonal side of it.",
    },
    {
      intent: "Acne",
      keywords: ["pcos acne", "hormonal acne", "acne from pcos"],
      reply:
        "🌼 PCOS-related acne is often driven by higher androgen levels and tends to show up along the jawline and chin. Gentle skincare can help day-to-day, but a dermatologist or gynecologist can offer treatments (topical or hormonal) targeted at the underlying cause.",
    },
    {
      intent: "Hair Growth",
      keywords: ["pcos hair growth", "excess hair", "hirsutism", "facial hair pcos"],
      reply:
        "🌼 Excess facial or body hair growth (hirsutism) in PCOS is related to higher androgen levels. Options range from cosmetic hair removal to medications that reduce androgen effects — a doctor can advise on what's appropriate and safe for you.",
    },
    {
      intent: "Fertility",
      keywords: ["pcos fertility", "pcos pregnancy", "pcos trying to conceive", "pcos infertility"],
      reply:
        "🌼 PCOS can make ovulation less predictable, which can affect fertility, but many people with PCOS do conceive, sometimes with support like ovulation tracking or medical treatment. A gynecologist or fertility specialist can guide you based on your specific situation.",
    },
  ],

  // ─────────────────────────────────────────────
  // PREGNANCY
  // ─────────────────────────────────────────────
  Pregnancy: [
    {
      intent: "Early Symptoms",
      keywords: ["early pregnancy symptom", "signs of pregnancy", "am i pregnant", "first signs of pregnancy"],
      reply:
        "🤰 Early pregnancy signs can include a missed period, nausea, breast tenderness, fatigue, and frequent urination — but these can also have other causes. A home pregnancy test and a doctor's confirmation are the most reliable way to know for sure.",
    },
    {
      intent: "Morning Sickness",
      keywords: ["morning sickness", "nausea pregnancy", "vomiting pregnancy"],
      reply:
        "🤰 Morning sickness is common, especially in the first trimester, and can happen at any time of day. Small frequent meals, ginger, staying hydrated, and avoiding strong smells can help. If vomiting is severe or you can't keep fluids down, please contact your doctor — that needs medical attention.",
    },
    {
      intent: "Nutrition",
      keywords: ["pregnancy nutrition", "what to eat pregnant", "pregnancy diet"],
      reply:
        "🤰 A balanced pregnancy diet typically includes folate, iron, calcium, and protein-rich foods, along with plenty of water. Prenatal vitamins are often recommended, but the right supplements and quantities should come from your doctor based on your individual needs.",
    },
    {
      intent: "Exercise",
      keywords: ["pregnancy exercise", "exercise while pregnant", "workout pregnant"],
      reply:
        "🤰 Light to moderate activity — like walking, swimming, or prenatal yoga — is generally safe and beneficial during pregnancy for most people, but this depends on your health and how the pregnancy is progressing. Please check with your doctor before starting or continuing any exercise routine.",
    },
    {
      intent: "Warning Signs",
      keywords: ["warning signs pregnancy", "pregnancy danger signs", "when to worry pregnant", "pregnancy red flags"],
      reply:
        "🤰 Warning signs to seek medical attention for during pregnancy include heavy bleeding, severe abdominal pain, severe headaches, vision changes, reduced fetal movement, or fluid leakage. If you're experiencing any of these, please contact your doctor or go to a hospital right away rather than waiting.",
    },
  ],

  // ─────────────────────────────────────────────
  // NUTRITION
  // ─────────────────────────────────────────────
  Nutrition: [
    {
      intent: "Iron",
      keywords: ["iron", "iron deficiency", "anemia", "iron rich food"],
      reply:
        "🥗 Iron-rich foods include leafy greens, legumes, lean red meat, and fortified cereals — pairing them with vitamin C (like citrus) helps absorption. Menstruating people are more prone to low iron; if you feel unusually fatigued or dizzy, ask a doctor about checking your levels rather than self-supplementing.",
    },
    {
      intent: "Calcium",
      keywords: ["calcium", "calcium rich food", "bone health"],
      reply:
        "🥗 Calcium supports bone health and can be found in dairy, fortified plant milks, leafy greens, and sesame seeds. Needs can shift during pregnancy or menopause — a doctor or dietitian can advise if you might need more than diet alone provides.",
    },
    {
      intent: "Protein",
      keywords: ["protein", "protein intake", "protein rich food"],
      reply:
        "🥗 Good protein sources include lentils, beans, eggs, dairy, fish, and lean meat. Protein needs vary by activity level, age, and health goals, so a dietitian can help you figure out the right amount for your situation.",
    },
    {
      intent: "Hydration",
      keywords: ["hydration", "how much water", "drink water", "dehydration"],
      reply:
        "🥗 Most people should aim for around 8 glasses (about 2 liters) of water a day, more if you're active, in a hot climate, or experiencing heavy periods. Pale yellow urine is usually a good sign you're hydrated enough.",
    },
    {
      intent: "Vitamins",
      keywords: ["vitamin", "vitamins", "vitamin d", "vitamin b12", "supplement"],
      reply:
        "🥗 Vitamins like D, B12, and folate play important roles in energy, bone health, and hormonal balance, and deficiencies are common, especially with limited sun exposure or certain diets. Before starting any supplement, it's best to check with a doctor — a simple blood test can confirm what you actually need.",
    },
  ],

  // ─────────────────────────────────────────────
  // MENTAL HEALTH
  // ─────────────────────────────────────────────
  "Mental Health": [
    {
      intent: "Anxiety",
      keywords: ["anxiety", "anxious", "worried all the time", "constant worry"],
      reply:
        "💜 Anxiety can show up as racing thoughts, restlessness, or physical tension, and everyone experiences it differently. Deep breathing, grounding techniques, and regular sleep can help in the moment, but if anxiety is frequent or overwhelming, a mental health professional can offer real support beyond self-management.",
    },
    {
      intent: "Stress",
      keywords: ["stress", "stressed", "overwhelmed", "burnout"],
      reply:
        "💜 Everyday stress often eases with small, consistent habits — short walks, breaks from screens, journaling, and talking to people you trust. If stress feels constant or unmanageable, that's worth bringing to a therapist or counselor rather than pushing through alone.",
    },
    {
      intent: "Depression",
      keywords: ["depressed", "depression", "feeling hopeless", "no motivation", "empty inside"],
      reply:
        "💜 Persistent low mood, loss of interest in things you used to enjoy, or feeling hopeless for weeks at a time are worth taking seriously. I can't diagnose depression, but a mental health professional can help — please consider reaching out to one, and know that support is available and effective.",
    },
    {
      intent: "Panic",
      keywords: ["panic attack", "panic", "can't breathe anxiety", "heart racing anxiety"],
      reply:
        "💜 During a panic attack, try slow breathing (in for 4 counts, hold for 4, out for 6), and remind yourself it will pass — panic attacks are intensely uncomfortable but not dangerous on their own. If they're frequent, a therapist can help you understand and manage triggers. If you have chest pain or aren't sure it's panic, seek medical care to rule out other causes.",
    },
    {
      intent: "Sleep",
      keywords: ["can't sleep", "insomnia", "sleep problems", "trouble sleeping"],
      reply:
        "💜 A consistent sleep schedule, limiting screens before bed, and a calming wind-down routine can improve sleep quality over time. If poor sleep persists for weeks or is affecting your daily life, a doctor can help rule out underlying causes like anxiety, hormonal shifts, or a sleep disorder.",
    },
    {
      intent: "Mood Swings",
      keywords: ["mood swings", "mood swing", "emotional ups and downs", "pms mood"],
      reply:
        "💜 Mood swings can be linked to hormonal shifts (like PMS), stress, or sleep, and tracking your mood alongside your cycle can help you anticipate them. If swings feel extreme or are affecting relationships or daily life, a doctor or therapist can help figure out what's driving them.",
    },
  ],

  // ─────────────────────────────────────────────
  // FIRST AID
  // ─────────────────────────────────────────────
  "First Aid": [
    {
      intent: "Burn",
      keywords: ["burn", "burned", "burnt myself"],
      reply:
        "🩹 For a minor burn: cool it under running water for 10–20 minutes, don't apply ice or butter, and cover loosely with a clean, non-stick dressing. For large burns, burns on the face/hands/genitals, or anything that looks deep or charred, seek emergency medical care immediately.",
    },
    {
      intent: "Cut",
      keywords: ["cut myself", "cut finger", "small cut", "laceration"],
      reply:
        "🩹 For a minor cut: rinse it with clean water, apply gentle pressure with a clean cloth to stop bleeding, then cover with a sterile bandage. Watch for signs of infection (redness, swelling, pus). If the cut is deep, won't stop bleeding, or gapes open, seek medical attention.",
    },
    {
      intent: "Bleeding",
      keywords: ["bleeding", "won't stop bleeding", "heavy bleeding wound"],
      reply:
        "🩹 For bleeding from an injury: apply firm, direct pressure with a clean cloth and keep the area elevated if possible. If bleeding is heavy, doesn't slow after several minutes of pressure, or is from a deep wound, treat it as an emergency and get medical help right away.",
    },
    {
      intent: "Sprain",
      keywords: ["sprain", "sprained ankle", "twisted ankle", "rolled my ankle"],
      reply:
        "🩹 For a sprain, the R.I.C.E. approach can help: Rest the area, Ice it for 15–20 minutes at a time, Compress gently with a bandage, and Elevate it above heart level when possible. If you can't bear weight, there's severe swelling, or pain is intense, get it checked by a doctor for a possible fracture.",
    },
    {
      intent: "Choking",
      keywords: ["choking", "someone is choking", "food stuck in throat"],
      reply:
        "🩹 If someone is choking and can't cough, speak, or breathe, call for emergency help immediately and perform back blows and abdominal thrusts (the Heimlich maneuver) if you're trained to do so. This is a genuine emergency — don't wait to see if it resolves on its own.",
    },
  ],

  // ─────────────────────────────────────────────
  // MEDICATION DISCLAIMER
  // ─────────────────────────────────────────────
  "Medication Disclaimer": [
    {
      intent: "Painkiller",
      keywords: ["painkiller", "pain medicine", "pain relief medicine"],
      reply:
        "💊 Over-the-counter pain relievers can help with everyday pain when used exactly as directed on the label, but I'm not able to recommend which one, how much, or how often for your situation. A pharmacist or doctor can advise based on your health history and any other medications you take.",
    },
    {
      intent: "Antibiotics",
      keywords: ["antibiotic", "antibiotics"],
      reply:
        "💊 Antibiotics need to be prescribed by a doctor based on the specific infection and should always be completed as directed — never shared, reused, or stopped early. Please see a doctor rather than self-treating with antibiotics.",
    },
    {
      intent: "Birth Control",
      keywords: ["birth control", "contraceptive pill", "the pill birth control"],
      reply:
        "💊 There are several types of birth control (pills, IUDs, implants, and more), each with different benefits and considerations depending on your health and goals. A gynecologist can help you choose the right option — I can't recommend a specific method for you.",
    },
    {
      intent: "Dosage",
      keywords: ["dosage", "how much should i take", "how many mg"],
      reply:
        "💊 I'm not able to provide medication dosages — the right amount depends on factors like your weight, health conditions, and other medications, which only a doctor or pharmacist can properly assess. Please check the label or ask a pharmacist, and consult a doctor for anything beyond basic over-the-counter use.",
    },
    {
      intent: "Side Effects",
      keywords: ["side effect", "side effects", "is it normal to feel"],
      reply:
        "💊 Medication side effects vary a lot by drug and by person. If you're experiencing something concerning after starting a medication, please contact the prescribing doctor or a pharmacist — don't stop or adjust a prescribed medication on your own without medical guidance.",
    },
  ],

  // ─────────────────────────────────────────────
  // WOMEN'S SAFETY
  // ─────────────────────────────────────────────
  "Women's Safety": [
    {
      intent: "Walking Alone",
      keywords: ["walking alone", "walk alone", "walking by myself"],
      reply:
        "🛡️ When walking alone, prefer well-lit, populated routes, stay off your phone, walk confidently, and consider sharing your live location with your Trusted Circle. Trust your instincts — if a route or situation feels wrong, it's okay to change direction or ask for help.",
    },
    {
      intent: "Cab Safety",
      keywords: ["cab safety", "taxi safety", "ola safety", "uber safety", "cab alone"],
      reply:
        "🛡️ For cab safety: verify the driver and vehicle number match the app before getting in, share your trip status with your Trusted Circle, sit behind the driver, and keep your phone charged and accessible. If anything feels off, trust that feeling and get out in a safe, public place.",
    },
    {
      intent: "Night Travel",
      keywords: ["night travel", "traveling at night", "out late at night"],
      reply:
        "🛡️ For night travel: plan your route in advance, prefer well-lit and busier streets, share your live location with your Trusted Circle, and let someone know your expected arrival time. A Safety Check-In can automatically alert your circle if you don't confirm you're safe.",
    },
    {
      intent: "Self Defence",
      keywords: ["self defence", "self defense", "how to defend myself", "protect myself"],
      reply:
        "🛡️ Basic self-defense awareness includes staying alert to your surroundings, keeping distance from potential threats, and knowing simple techniques (like a palm strike or knee strike) as a last resort — a certified self-defense class is the best way to learn these properly and safely. Your safety always comes first over confrontation.",
    },
    {
      intent: "Trusted Circle",
      keywords: ["trusted circle", "add emergency contact", "who gets notified"],
      reply:
        "🛡️ Your Trusted Circle is the group of people notified if you trigger SOS or miss a Safety Check-In. Add people you'd want alerted in an emergency — close family, friends, or roommates — with their phone numbers, so they can be reached quickly if needed.",
    },
    {
      intent: "Safe Route",
      keywords: ["safe route", "safest way home", "safest path"],
      reply:
        "🛡️ Safe Route Planning helps you choose a path based on factors like lighting and how populated an area is, rather than just the fastest option. It's especially useful at night or in unfamiliar areas — want me to open Safe Route Planning for you?",
    },
  ],
};

export default INTENTS;