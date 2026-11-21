import { useState } from 'react';
import { CheckCircle2, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../i18n';
import { RUST_MODULES } from '../data/rustModules';
import type { DiscoveredDevice, LocalInfo } from '../types';
import { CodeViewer } from './CodeViewer';

interface QuicWorkbenchProps {
  localInfo: LocalInfo;
  devices: DiscoveredDevice[];
  pairedIds: string[];
}

export function QuicWorkbench({ localInfo, devices, pairedIds }: QuicWorkbenchProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(0);
  const [selectedPeerId, setSelectedPeerId] = useState<string>(devices[0]?.id ?? '');
  const [isSimulating, setIsSimulating] = useState(false);

  const selectedPeer = devices.find((d) => d.id === selectedPeerId) ?? devices[0];
  const quicModule = RUST_MODULES.find((m) => m.id === 'quic')!;
  const cargoModule = RUST_MODULES.find((m) => m.id === 'cargo')!;

  const steps = [
    {
      title: t('step1Title'),
      detail: selectedPeer
        ? `UDP ${selectedPeer.ip}:${selectedPeer.port} · ALPN karkax/1`
        : 'UDP 0.0.0.0:24800 · ALPN karkax/1',
    },
    {
      title: t('step2Title'),
      detail: selectedPeer ? `SHA-256 ${selectedPeer.fingerprint}` : localInfo.fingerprint,
    },
    {
      title: t('step3Title'),
      detail: selectedPeer ? `HMAC-SHA256(PIN:${selectedPeer.pin}, nonce, fp)` : 'HMAC-SHA256',
    },
    {
      title: t('step4Title'),
      detail: selectedPeer
        ? `${selectedPeer.name} (${pairedIds.includes(selectedPeer.id) ? t('paired') : 'TOFU'})`
        : 'Trusted peer saved',
    },
  ];

  const handleRunHandshake = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setStep(1);
    setTimeout(() => setStep(2), 280);
    setTimeout(() => setStep(3), 560);
    setTimeout(() => {
      setStep(4);
      setIsSimulating(false);
    }, 840);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="text-start max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('quicTitle')}</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{t('quicDesc')}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {devices.length > 0 && (
              <select
                value={selectedPeer?.id ?? ''}
                onChange={(e) => {
                  setSelectedPeerId(e.target.value);
                  setStep(0);
                }}
                className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.ip})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleRunHandshake}
              disabled={isSimulating}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t('runHandshake')}
            </button>

            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(0)}
                aria-label={t('resetHandshake')}
                className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Local Identity Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-start">
          <div>
            <div className="text-xs text-slate-500">{t('localHostLabel')}</div>
            <div className="text-sm font-medium text-slate-200 mt-1">
              {localInfo.name} · {localInfo.os.toUpperCase()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t('alpnLabel')}</div>
            <div className="text-sm font-mono text-slate-200 mt-1" dir="ltr">
              karkax/1 · TLS 1.3
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t('fingerprintLabel')}</div>
            <div className="text-xs font-mono text-emerald-400 mt-1 truncate" dir="ltr">
              {localInfo.fingerprint}
            </div>
          </div>
        </div>

        {/* 4-Step Handshake Trace */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s, idx) => {
            const done = step >= idx + 1;
            return (
              <div
                key={s.title}
                className={`rounded-lg border p-3.5 text-start transition-colors ${
                  done
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-800 bg-[#0B101B]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">{s.title}</span>
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-2 truncate" dir="ltr">
                  {s.detail}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <CodeViewer
        filename={quicModule.filename}
        summary={quicModule.summary}
        code={quicModule.code}
      />

      <CodeViewer
        filename={cargoModule.filename}
        summary={cargoModule.summary}
        code={cargoModule.code}
      />
    </div>
  );
}
