// Simple i18n config for demonstration
export const translations: { [lang: string]: { [key: string]: string } } = {
  en: {
    welcome: "Welcome",
    book: "Book",
    host: "Host",
    admin: "Admin",
    help: "Help Center",
    trust: "Trust & Safety",
  },
  fr: {
    welcome: "Bienvenue",
    book: "Réserver",
    host: "Hôte",
    admin: "Admin",
    help: "Centre d'aide",
    trust: "Confiance & sécurité",
  },
  es: {
    welcome: "Bienvenido",
    book: "Reservar",
    host: "Anfitrión",
    admin: "Admin",
    help: "Centro de ayuda",
    trust: "Confianza y seguridad",
  },
};

export function t(lang: string, key: string) {
  return translations[lang]?.[key] || translations.en[key] || key;
}
