import { useState } from 'react';
import { Check, Copy, FileCode2 } from 'lucide-react';
import { useTranslation } from '../i18n';

interface CodeViewerProps {
  filename: string;
  summary: string;
  code: string;
}

export function CodeViewer({ filename, summary, code }: CodeViewerProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0B101B] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0 text-start">
            <div className="text-xs font-mono font-medium text-slate-200 truncate" dir="ltr">
              {filename}
            </div>
            <div className="text-xs text-slate-400 truncate">{summary}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('copied')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('copyCode')}</span>
            </>
          )}
        </button>
      </div>
      <pre
        dir="ltr"
        className="p-4 text-xs leading-relaxed font-mono text-slate-300 overflow-x-auto max-h-[420px] text-left"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
