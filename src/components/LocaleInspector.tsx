import { useState } from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGES, LOCALE_BUNDLES, type LanguageCode, useTranslation } from '../i18n';
import { CodeViewer } from './CodeViewer';

export function LocaleInspector() {
  const { language, setLanguage, t } = useTranslation();
  const [inspectLang, setInspectLang] = useState<LanguageCode>(language);

  const bundleJson = JSON.stringify(LOCALE_BUNDLES[inspectLang], null, 2);
  const langMeta = LANGUAGES.find((l) => l.code === inspectLang)!;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-start">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('navLocales')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              src/locales/{inspectLang}.json · {langMeta.name} ({langMeta.dir.toUpperCase()})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setInspectLang(lang.code);
                  setLanguage(lang.code);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  inspectLang === lang.code
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <CodeViewer
        filename={`src/locales/${inspectLang}.json`}
        summary={`${langMeta.name} · ${langMeta.dir.toUpperCase()}`}
        code={bundleJson}
      />
    </div>
  );
}
