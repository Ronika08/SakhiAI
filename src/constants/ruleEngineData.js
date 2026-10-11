/**
 * constants/ruleEngineData.js
 *
 * Phase 6 — Hybrid AI Assistant: Rule Engine data.
 *
 * PURE DATA ONLY. No functions, no matching logic, no imports.
 * Matching logic lives in services/chatService.js, which imports RULES
 * from this file as:
 *
 *   import { RULES } from "../constants/ruleEngineData";
 *
 * Order matters: RULES is priority-ordered top-to-bottom. Emergency is
 * first so it can never be shadowed by another category. Greeting is
 * last, as the lowest-priority, non-medical category.
 *
 * Shape of each rule:
 *   {
 *     category: string,        // one of the 10 categories below
 *     keywords: string[],      // lowercase substrings matched against
 *                              // the user's lowercased message
 *     reply: string,           // immediate reply shown to the user
 *     action: string | null,   // "OPEN_EMERGENCY" for Emergency, null otherwise
 *     isEmergency: boolean,    // true only for the Emergency category
 *   }
 */

export const RULES = [
  // ─────────────────────────────────────────────
  // 1. EMERGENCY — highest priority, checked first
  // ─────────────────────────────────────────────
  {
    category: "Emergency",
    keywords: [
      "help",
      "unsafe",
      "danger",
      "followed",
      "following me",
      "someone following",
      "stalker",
      "stalking",
      "kidnap",
      "attack",
      "harassment",
      "harass",
      "abuse",
      "violence",
      "molest",
      "emergency",
      "in trouble",
      "scared",
    ],
    reply:
      "🚨 You may be in danger. Please prioritize your safety right now. If you can, move to a public, well-lit place or somewhere with other people. Activate SOS to alert your Trusted Circle with your live location, and if you're in immediate danger, contact local emergency services right away.",
    action: "OPEN_EMERGENCY",
    isEmergency: true,
  },

  // ─────────────────────────────────────────────
  // 2. PERIODS
  // ─────────────────────────────────────────────
  {
    category: "Periods",
    keywords: [
      "period",
      "periods",
      "menstrual",
      "menstruation",
      "cramps",
      "period pain",
      "heavy bleeding",
      "missed period",
      "spotting",
      "irregular period",
    ],
    reply:
      "🌸 A typical menstrual cycle runs 21–35 days, and mild cramps can often be eased with a heating pad, hydration, rest, and gentle movement. If your periods are consistently irregular, unusually heavy, or the pain is severe, please check in with a doctor — that's worth getting looked at rather than just managed at home. This is educational information, not a diagnosis.",
    action: null,
    isEmergency: false,
  },

  // ─────────────────────────────────────────────
  // 3. PCOS
  // ─────────────────────────────────────────────
  {
    category: "PCOS",
    keywords: [
      "pcos",
      "pcod",
      "ovarian cyst",
      "irregular ovulation",
      "hormonal imbalance",
    ],
    reply:
      "🌼 PCOS (Polycystic Ovary Syndrome) is a common hormonal condition that can affect periods, weight, skin, and fertility. A balanced diet, regular movement, stress management, and sleep can help manage symptoms, but PCOS is diagnosed and treated with a doctor's guidance — please consult one for a personalized plan rather than self-treating.",
    action: null,
    isEmergency: false,
  },

  // ─────────────────────────────────────────────
  // 4. PREGNANCY
  // ─────────────────────────────────────────────
  {
    category: "Pregnancy",
    keywords: [
      "pregnancy",
      "pregnant",
      "trimester",
      "morning sickness",
      "prenatal",
    ],
    reply:
      "🤰 Pregnancy is a good time to focus on balanced nutrition, gentle activity, hydration, and regular prenatal check-ups. Every pregnancy is different, so please treat this as general information only — your doctor or gynecologist should guide any decisions specific to you or your baby.",
    action: null,
    isEmergency: false,
  },

  // ─────────────────────────────────────────────
  // 5. NUTRITION
  // ─────────────────────────────────────────────
  {
    category: "Nutrition",
    keywords: [
      "diet",
      "nutrition",
      "healthy food",
      "iron",
      "protein",
      "vitamins",
      "what should i eat",
    ],
    reply:
      "🥗 A balanced diet with iron-rich foods (leafy greens, legumes, lean protein), whole grains, healthy fats, and plenty of water supports hormonal balance and energy levels. If you're managing a specific condition or have particular dietary needs, a doctor or nutritionist can tailor this to you.",
    action: null,
    isEmergency: false,
  },

  // ─────────────────────────────────────────────
  // 6. MENTAL HEALTH
  // ─────────────────────────────────────────────
  {
    category: "Mental Health",
    keywords: [
      "anxiety",
      "depression",
      "stress",
      "overwhelmed",
      "panic attack",
      "mood swings",
    ],
    reply:
      "💜 It's okay to not be okay. Small, steady habits — regular sleep, light movement, journaling, and staying connected with people you trust — can help with everyday stress and mood shifts. If these feelings are constant, intense, or affecting your daily life, please consider talking to a mental health professional — reaching out is a strong, healthy step, not a last resort.",
    action: null,
    isEmergency: false,
  },

  // ─────────────────────────────────────────────
  // 7. WOMEN'S SAFETY (general/preventive, distinct from Emergency)
  // ─────────────────────────────────────────────
  {
    category: "Women's Safety",
    keywords: [
      "safe route",
      "walking alone",
      "trusted circle",
      "self defense",
      "share location",
      "night travel",
    ],
    reply:
      "🛡️ A few habits go a long way: share your live location with your Trusted Circle on unfamiliar trips, prefer well-lit and populated routes, keep your phone charged, and set a Safety Check-In for solo travel or late commutes so someone is automatically alerted if you don't confirm you're safe.",
    action: null,
    isEmergency: false,
  },

  // ─────────────────────────────────────────────
  // 8. FIRST AID
  // ─────────────────────────────────────────────
  {
    category: "First Aid",
    keywords: [
      "wound",
      "bleeding",
      "burn",
      "faint",
      "sprain",
      "choking",
      "injury",
    ],
    reply:
      "🩹 For minor injuries: clean a wound with clean water, apply gentle pressure to stop bleeding, cool a burn under running water for several minutes, and rest a sprain with ice and elevation. This is general first-aid information only — for anything severe, uncontrolled bleeding, difficulty breathing, or loss of consciousness, seek emergency medical help immediately.",
    action: null,
    isEmergency: false,
  },

  // ─────────────────────────────────────────────
  // 9. MEDICATION DISCLAIMER
  // ─────────────────────────────────────────────
  {
    category: "Medication Disclaimer",
    keywords: [
      "medicine",
      "tablet",
      "dosage",
      "painkiller",
      "antibiotic",
      "birth control",
    ],
    reply:
      "💊 I can share general health information, but I'm not able to recommend specific medications, dosages, or prescriptions — that needs to come from a doctor or pharmacist who knows your health history. Please consult a healthcare professional before starting, stopping, or combining any medication.",
    action: null,
    isEmergency: false,
  },

  // ─────────────────────────────────────────────
  // 10. GREETING — lowest priority, checked last
  // ─────────────────────────────────────────────
  {
    category: "Greeting",
    keywords: ["hi", "hello", "hey"],
    reply: "👋 Hello! I'm SakhiAI. How can I help you today?",
    action: null,
    isEmergency: false,
  },
];

export default RULES;