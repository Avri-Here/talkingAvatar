import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { loadConfig } from "./utils/config-loader";

// Import translation resources
import enTranslation from "./locales/en/translation.json";
import zhTranslation from "./locales/zh/translation.json";

// Load language from config
loadConfig().then((config) => {
  i18n.changeLanguage(config.general.language);
}).catch((error) => {
  console.error('Failed to load language config:', error);
});

// Configure i18next instance
i18n
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    // Default language when detection fails
    fallbackLng: "en",
    lng: "en",
    // Debug mode for development
    debug: process.env.NODE_ENV === "development",
    // Namespaces configuration
    defaultNS: "translation",
    ns: ["translation"],
    // Resources containing translations
    resources: {
      en: {
        translation: enTranslation,
      },
      zh: {
        translation: zhTranslation,
      },
    },
    // Escaping special characters
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    // React config
    react: {
      useSuspense: true,
    },
  });

// Update HTML document lang attribute on language change
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
