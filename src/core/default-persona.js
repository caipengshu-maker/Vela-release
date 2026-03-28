import { getPersonaConfig } from "../i18n/system-prompts.js";

function clipText(text, limit = 18) {
  if (!text) {
    return "";
  }

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function getOnboardingOptions(locale = "zh-CN") {
  const config = getPersonaConfig(locale);
  return config.onboardingOptions;
}

// Keep backward-compatible named export
export const onboardingOptions = getOnboardingOptions("zh-CN");

export function relationshipPreset(distance = "warm", locale = "zh-CN") {
  const config = getPersonaConfig(locale);
  return config.distance[distance] || config.distance.warm;
}

export function buildPersona(profile = {}, locale = "zh-CN") {
  const config = getPersonaConfig(locale);
  const onboarding = profile.onboarding || {};
  const temperament = config.temperament[onboarding.temperament] || config.temperament["gentle-cool"];
  const distance = relationshipPreset(onboarding.distance, locale);
  const personaName = clipText(onboarding.velaName || "Vela", 20);
  const userName = clipText(onboarding.userName || profile.user?.name || (locale === "en" ? "you" : "你"), 20);

  return {
    id: `vela-${onboarding.temperament || "gentle-cool"}`,
    name: personaName,
    shortBio: temperament.shortBio,
    seedPrompt: config.buildSeedPrompt({
      personaName,
      userName,
      tonePrompt: temperament.tonePrompt,
      relationshipPrompt: distance.relationshipPrompt
    })
  };
}
