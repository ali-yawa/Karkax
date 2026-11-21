import React, { useState } from 'react';
import { Keyboard, Monitor, MousePointer2 } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { DiscoveredDevice, LocalInfo, ScreenEdge } from '../types';

interface TopologyCanvasProps {
  localInfo: LocalInfo;
  pairedDevices: DiscoveredDevice[];
  onChangeEdge: (deviceId: string, edge: ScreenEdge) => void;
  inputEnabled: boolean;
}

export function TopologyCanvas({
  localInfo,
  pairedDevices,
  onChangeEdge,
  inputEnabled,
}: TopologyCanvasProps) {
  const { t } = useTranslation();
  const [activeTargetId, setActiveTargetId] = useState<string>(localInfo.id);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [lastKey, setLastKey] = useState<string>('—');

  const edgeLabels: Record<ScreenEdge, string> = {
    left: t('edgeLeft'),
    right: t('edgeRight'),
    top: t('edgeTop'),
    bottom: t('edgeBottom'),
  };

  const activeDeviceName =
    activeTargetId === localInfo.id
      ? localInfo.name
      : pairedDevices.find((d) => d.id === activeTargetId)?.name ?? localInfo.name;

  const handlePadMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const yPct = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    setCursorCoords({ x: xPct, y: yPct });

    if (!inputEnabled || pairedDevices.length === 0) {
      setActiveTargetId(localInfo.id);
      return;
    }

    if (xPct <= 14) {
      const leftDev = pairedDevices.find((d) => d.edge === 'left');
      if (leftDev) {
        setActiveTargetId(leftDev.id);
        return;
      }
    }
    if (xPct >= 86) {
      const rightDev = pairedDevices.find((d) => d.edge === 'right');
      if (rightDev) {
        setActiveTargetId(rightDev.id);
        return;
      }
    }
    if (yPct <= 16) {
      const topDev = pairedDevices.find((d) => d.edge === 'top');
      if (topDev) {
        setActiveTargetId(topDev.id);
        return;
      }
    }
    if (yPct >= 84) {
      const bottomDev = pairedDevices.find((d) => d.edge === 'bottom');
      if (bottomDev) {
        setActiveTargetId(bottomDev.id);
        return;
      }
    }
    setActiveTargetId(localInfo.id);
  };

  const handlePadKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    setLastKey(e.key === ' ' ? 'Space' : e.key);
  };

  const deviceAt = (edge: ScreenEdge) => pairedDevices.find((d) => d.edge === edge);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="text-start">
          <h2 className="text-base font-semibold text-slate-100">{t('topologyTitle')}</h2>
          <p className="text-xs text-slate-400 mt-1">{t('topologyDesc')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300 tabular-nums">
          <span className="text-slate-500">{t('activeScreen')}:</span>
          <span className="font-medium text-emerald-400">{activeDeviceName}</span>
        </div>
      </div>

      {/* Screen Arrangement Grid */}
      <div
        dir="ltr"
        className="grid grid-cols-3 gap-3 items-center justify-items-center py-4 px-3 rounded-xl border border-slate-800 bg-[#0B101B]"
      >
        <div />
        <ScreenSlot
          edge="top"
          label={edgeLabels.top}
          device={deviceAt('top')}
          isActive={deviceAt('top')?.id === activeTargetId}
        />
        <div />

        <ScreenSlot
          edge="left"
          label={edgeLabels.left}
          device={deviceAt('left')}
          isActive={deviceAt('left')?.id === activeTargetId}
        />

        {/* Local Host Monitor */}
        <div
          className={`w-full max-w-[200px] rounded-lg border px-3.5 py-4 text-center transition-colors ${
            activeTargetId === localInfo.id
              ? 'border-emerald-500/60 bg-emerald-500/10 text-slate-100'
              : 'border-slate-700 bg-slate-900 text-slate-300'
          }`}
        >
          <Monitor className="w-5 h-5 mx-auto mb-1.5 text-emerald-400" />
          <div className="text-xs font-semibold truncate">{localInfo.name}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {t('thisDevice')} · {localInfo.os.toUpperCase()}
          </div>
        </div>

        <ScreenSlot
          edge="right"
          label={edgeLabels.right}
          device={deviceAt('right')}
          isActive={deviceAt('right')?.id === activeTargetId}
        />

        <div />
        <ScreenSlot
          edge="bottom"
          label={edgeLabels.bottom}
          device={deviceAt('bottom')}
          isActive={deviceAt('bottom')?.id === activeTargetId}
        />
        <div />
      </div>

      {/* Edge assignment controls for paired devices */}
      {pairedDevices.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {pairedDevices.map((dev) => (
            <div
              key={dev.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-slate-800/80 last:border-b-0"
            >
              <div className="text-start text-xs">
                <span className="font-medium text-slate-200">{dev.name}</span>
                <span className="text-slate-500 mx-2">·</span>
                <span className="font-mono text-slate-400">{dev.ip}</span>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
                {(['left', 'right', 'top', 'bottom'] as ScreenEdge[]).map((edge) => (
                  <button
                    key={edge}
                    type="button"
                    onClick={() => onChangeEdge(dev.id, edge)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      dev.edge === edge
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {edgeLabels[edge]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Pointer & Keystroke Test Pad */}
      <div
        tabIndex={0}
        onMouseMove={handlePadMove}
        onMouseLeave={() => setActiveTargetId(localInfo.id)}
        onKeyDown={handlePadKey}
        className="rounded-xl border border-dashed border-slate-700 bg-[#0B101B] p-4 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-crosshair select-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-start">
            <div className="text-xs font-medium text-slate-200 flex items-center gap-2">
              <MousePointer2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('testPadTitle')}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{t('testPadHint')}</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-400" dir="ltr">
            <span>
              X:{cursorCoords.x}% Y:{cursorCoords.y}%
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Keyboard className="w-3.5 h-3.5 text-slate-500" />
              {lastKey}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScreenSlot({
  label,
  device,
  isActive,
}: {
  edge: ScreenEdge;
  label: string;
  device?: DiscoveredDevice;
  isActive: boolean;
}) {
  if (!device) {
    return (
      <div className="w-full max-w-[180px] rounded-lg border border-dashed border-slate-800 px-3 py-3 text-center text-[11px] text-slate-600">
        {label}
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-[180px] rounded-lg border px-3 py-3 text-center transition-colors ${
        isActive
          ? 'border-emerald-500 bg-emerald-500/15 text-slate-100'
          : 'border-slate-700 bg-slate-900/90 text-slate-300'
      }`}
    >
      <div className="text-xs font-medium truncate">{device.name}</div>
      <div className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
        {device.os.toUpperCase()} · {device.ip}
      </div>
    </div>
  );
}
