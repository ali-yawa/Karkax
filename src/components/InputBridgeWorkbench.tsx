import React, { useState } from 'react';
import { Clipboard, Keyboard, Mouse, Send } from 'lucide-react';
import { useTranslation } from '../i18n';
import { RUST_MODULES } from '../data/rustModules';
import type { DiscoveredDevice, SharingFeatures } from '../types';
import { CodeViewer } from './CodeViewer';

interface InputBridgeWorkbenchProps {
  pairedDevices: DiscoveredDevice[];
  features: SharingFeatures;
}

interface CapturedFrame {
  id: number;
  kind: 'MouseMoveRel' | 'MouseButton' | 'KeyEvent' | 'ClipboardText';
  payload: string;
}

export function InputBridgeWorkbench({ pairedDevices, features }: InputBridgeWorkbenchProps) {
  const { t } = useTranslation();
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [clipboardText, setClipboardText] = useState('');
  const [syncedBanner, setSyncedBanner] = useState('');

  const inputModule = RUST_MODULES.find((m) => m.id === 'input')!;
  const libModule = RUST_MODULES.find((m) => m.id === 'lib')!;

  const pushFrame = (kind: CapturedFrame['kind'], payload: string) => {
    setFrames((prev) => [{ id: Date.now() + Math.random(), kind, payload }, ...prev].slice(0, 6));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!features.input) return;
    if (e.movementX === 0 && e.movementY === 0) return;
    pushFrame('MouseMoveRel', `dx: ${e.movementX}, dy: ${e.movementY}`);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!features.input) return;
    pushFrame('MouseButton', `button: ${e.button}, pressed: true`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!features.input) return;
    e.preventDefault();
    pushFrame('KeyEvent', `key: "${e.key}", pressed: true`);
  };

  const handleSyncClipboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clipboardText.trim()) return;
    pushFrame('ClipboardText', `"${clipboardText.slice(0, 32)}"`);
    setSyncedBanner(clipboardText.trim());
    setClipboardText('');
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col gap-5">
        <div className="text-start">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{t('inputTitle')}</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{t('inputDesc')}</p>
        </div>

        {/* Architectural Order Guidance */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-start">
          <div className="text-xs font-semibold text-emerald-300">{t('recommendedOrderTitle')}</div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{t('recommendedOrderBody')}</p>
        </div>

        {/* Live Input Frame Capture & Clipboard Sync Sandbox */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <div
              tabIndex={0}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onKeyDown={handleKeyDown}
              className="rounded-xl border border-dashed border-slate-700 bg-[#0B101B] p-5 min-h-[140px] flex flex-col justify-between outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-crosshair select-none text-start"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                  <Mouse className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('testPadTitle')}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {pairedDevices.length} {t('paired')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{t('testPadHint')}</p>
            </div>

            <form onSubmit={handleSyncClipboard} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Clipboard className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                <input
                  type="text"
                  value={clipboardText}
                  onChange={(e) => setClipboardText(e.target.value)}
                  placeholder={t('clipboardPlaceholder')}
                  className="w-full ps-9 pe-3 py-2 rounded-lg border border-slate-800 bg-[#0B101B] text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t('syncNow')}</span>
              </button>
            </form>

            {syncedBanner && (
              <div className="text-xs text-slate-400 text-start">
                <span className="text-slate-500">{t('clipboardTestLabel')}: </span>
                <span className="text-emerald-300 font-mono">{syncedBanner}</span>
              </div>
            )}
          </div>

          {/* Captured InputFrame Stream Preview */}
          <div className="rounded-xl border border-slate-800 bg-[#0B101B] p-4 flex flex-col gap-2">
            <div className="text-xs font-medium text-slate-400 text-start">InputFrame (bincode)</div>
            {frames.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-600 py-8">
                {t('testPadHint')}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 font-mono text-[11px]" dir="ltr">
                {frames.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 py-1 border-b border-slate-800/60 last:border-b-0"
                  >
                    <span className="text-emerald-400">{f.kind}</span>
                    <span className="text-slate-300 truncate">{f.payload}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <CodeViewer
        filename={inputModule.filename}
        summary={inputModule.summary}
        code={inputModule.code}
      />

      <CodeViewer
        filename={libModule.filename}
        summary={libModule.summary}
        code={libModule.code}
      />
    </div>
  );
}
