import { useEffect, useMemo, useState } from 'react';
import {
  Clipboard,
  FolderSync,
  Globe,
  Keyboard,
  Lock,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Volume2,
  Wifi,
} from 'lucide-react';
import { LANGUAGES, type LanguageCode, useTranslation } from './i18n';
import type { DiscoveredDevice, LocalInfo, NavTab, ScreenEdge, SharingFeatures } from './types';
import { TopologyCanvas } from './components/TopologyCanvas';
import { QuicWorkbench } from './components/QuicWorkbench';
import { InputBridgeWorkbench } from './components/InputBridgeWorkbench';
import { LocaleInspector } from './components/LocaleInspector';

const INITIAL_LOCAL_INFO: LocalInfo = {
  id: '7b94c2e1-local',
  name: 'Karkax-Desktop',
  os: 'macos',
  ip: '192.168.1.18',
  port: 24800,
  pin: '482915',
  fingerprint: 'a9f4:82c1:0e3b:77d2:91a0:4c6e:55f8:12b9',
};

const INITIAL_LAN_PEERS: DiscoveredDevice[] = [
  {
    id: 'peer-win-01',
    name: 'Studio-Win11',
    os: 'windows',
    ip: '192.168.1.42',
    port: 24800,
    pin: '639104',
    fingerprint: 'd41e:902a:6f1b:38c4:72e9:0a5d:83c1:f402',
    edge: 'right',
  },
  {
    id: 'peer-linux-02',
    name: 'BuildNode-Linux',
    os: 'linux',
    ip: '192.168.1.77',
    port: 24800,
    pin: '195482',
    fingerprint: '7c22:18f0:44b9:c301:e8d4:62a7:9f10:33e5',
    edge: 'left',
  },
];

function randomSixDigitPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function App() {
  const { t, language, setLanguage } = useTranslation();

  const [activeTab, setActiveTab] = useState<NavTab>('devices');
  const [localInfo, setLocalInfo] = useState<LocalInfo>(INITIAL_LOCAL_INFO);
  const [devices, setDevices] = useState<DiscoveredDevice[]>(INITIAL_LAN_PEERS);
  const [pairedIds, setPairedIds] = useState<string[]>(['peer-win-01']);
  const [pairingTarget, setPairingTarget] = useState<DiscoveredDevice | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'paired' | 'available'>('all');

  const [features, setFeatures] = useState<SharingFeatures>({
    input: true,
    clipboard: true,
    files: true,
    audio: false,
  });

  // Connect to native Tauri runtime when available; otherwise run interactive web preview
  useEffect(() => {
    const win = window as unknown as {
      __TAURI_INTERNALS__?: {
        invoke?: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      };
    };
    const tauriInvoke = win.__TAURI_INTERNALS__?.invoke;
    if (!tauriInvoke) return;

    tauriInvoke<Partial<LocalInfo>>('get_local_info')
      .then((info) => {
        if (info?.id && info?.name) {
          setLocalInfo((prev) => ({
            ...prev,
            id: info.id ?? prev.id,
            name: info.name ?? prev.name,
            os: (info.os as LocalInfo['os']) ?? prev.os,
            pin: info.pin ?? prev.pin,
          }));
        }
      })
      .catch(() => {});

    tauriInvoke('start_discovery').catch(() => {});
  }, []);

  const filteredDevices = useMemo(() => {
    return devices.filter((dev) => {
      const isPaired = pairedIds.includes(dev.id);
      if (deviceFilter === 'paired' && !isPaired) return false;
      if (deviceFilter === 'available' && isPaired) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        dev.name.toLowerCase().includes(q) ||
        dev.ip.includes(q) ||
        dev.os.toLowerCase().includes(q)
      );
    });
  }, [devices, pairedIds, deviceFilter, searchQuery]);

  const pairedDevices = useMemo(
    () => devices.filter((d) => pairedIds.includes(d.id)),
    [devices, pairedIds]
  );

  const handleRescan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 650);
  };

  const handleAddSimulatedNode = () => {
    const idx = devices.length + 1;
    const osPool: DiscoveredDevice['os'][] = ['macos', 'windows', 'linux'];
    const os = osPool[idx % osPool.length];
    const edges: ScreenEdge[] = ['left', 'right', 'top', 'bottom'];
    const newNode: DiscoveredDevice = {
      id: `peer-sim-${Date.now()}`,
      name: `Workstation-0${idx}`,
      os,
      ip: `192.168.1.${90 + idx}`,
      port: 24800,
      pin: randomSixDigitPin(),
      fingerprint: 'b3e1:44a0:9c7d:22f8:10b5:66d9:e1a2:84c7',
      edge: edges[idx % edges.length],
    };
    setDevices((prev) => [...prev, newNode]);
  };

  const handleConfirmPair = () => {
    if (!pairingTarget || pinInput.length < 6) return;
    if (pinInput !== pairingTarget.pin) {
      setPinError(true);
      return;
    }
    setPairedIds((prev) => Array.from(new Set([...prev, pairingTarget.id])));
    setPairingTarget(null);
    setPinInput('');
    setPinError(false);
  };

  const handleUnpair = (id: string) => {
    setPairedIds((prev) => prev.filter((item) => item !== id));
  };

  const handleChangeEdge = (deviceId: string, edge: ScreenEdge) => {
    setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, edge } : d)));
  };

  const navItems: { id: NavTab; label: string; icon: typeof Wifi }[] = [
    { id: 'devices', label: t('navDevices'), icon: Wifi },
    { id: 'quic', label: t('navQuic'), icon: Lock },
    { id: 'input', label: t('navInput'), icon: Keyboard },
    { id: 'locales', label: t('navLocales'), icon: Globe },
  ];

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label ?? t('appTitle');

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-e border-slate-800 bg-[#0C121E] flex flex-col justify-between p-5 gap-6">
        <div className="flex flex-col gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 text-start">
              <div className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                {t('appTitle')}
              </div>
              <div className="text-[11px] text-slate-400 truncate">{t('appSubtitle')}</div>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer text-start ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Local Host Identity & PIN + Language Switcher */}
        <div className="flex flex-col gap-4 pt-4 border-t border-slate-800/80">
          <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3.5 text-start flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span>{localInfo.name}</span>
              </span>
              <span className="font-mono text-[11px] uppercase">{localInfo.os}</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <div>
                <div className="text-[11px] text-slate-500">{t('localPinLabel')}</div>
                <div className="text-base font-mono font-semibold text-white tracking-widest tabular-nums mt-0.5">
                  {localInfo.pin}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLocalInfo((prev) => ({ ...prev, pin: randomSixDigitPin() }))
                }
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap cursor-pointer"
              >
                {t('regeneratePin')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-[#090D16]">
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <Globe className="w-3.5 h-3.5" />
              <span>{t('language')}</span>
            </span>
            <select
              aria-label={t('language')}
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-100">
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Clean 3-Zone Contract) */}
        <header className="h-16 px-6 border-b border-slate-800 flex items-center justify-between gap-8 shrink-0">
          <div className="text-sm font-semibold text-slate-100 whitespace-nowrap truncate">
            {activeNavLabel}
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
            <span>_karkax._tcp.local.</span>
            <span aria-hidden="true">·</span>
            <span>UDP {localInfo.port}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">
              {isScanning ? t('statusSearching') : t('statusReady')}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRescan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{t('scanLan')}</span>
          </button>
        </header>

        {/* Viewport Body */}
        <main className="flex-1 p-6 max-w-[1280px] w-full mx-auto flex flex-col gap-6">
          {activeTab === 'devices' && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                {/* Discovered LAN Devices Panel */}
                <section className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-emerald-400" />
                      <span>{t('devices')}</span>
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        ({filteredDevices.length})
                      </span>
                    </h1>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
                        {(['all', 'paired', 'available'] as const).map((filterKey) => (
                          <button
                            key={filterKey}
                            type="button"
                            onClick={() => setDeviceFilter(filterKey)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              deviceFilter === filterKey
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {filterKey === 'all'
                              ? t('filterAll')
                              : filterKey === 'paired'
                              ? t('filterPaired')
                              : t('filterAvailable')}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddSimulatedNode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('addSimNode')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('searchDevices')}
                      className="w-full ps-9 pe-3 py-2 rounded-lg border border-slate-800 bg-[#0B101B] text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Device Rows */}
                  {isScanning ? (
                    <div className="flex flex-col gap-3 py-2">
                      {[1, 2].map((skeleton) => (
                        <div
                          key={skeleton}
                          className="h-16 rounded-lg border border-slate-800 bg-slate-900/80 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : filteredDevices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12 px-4 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      <Monitor className="w-9 h-9 mb-3 opacity-40" />
                      <p className="text-sm max-w-sm">{t('noDevices')}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-[#0B101B]">
                      {filteredDevices.map((dev) => {
                        const isPaired = pairedIds.includes(dev.id);
                        return (
                          <div
                            key={dev.id}
                            className="p-4 flex flex-wrap items-center justify-between gap-4"
                          >
                            <div className="text-start min-w-0">
                              <div className="font-medium text-sm text-slate-100 flex items-center gap-2">
                                <span>{dev.name}</span>
                                <span className="text-xs font-normal text-slate-400">
                                  · {isPaired ? t('paired') : dev.edge}
                                </span>
                              </div>
                              <div
                                className="text-xs font-mono text-slate-400 mt-1 tabular-nums flex items-center gap-2"
                                dir="ltr"
                              >
                                <span>{dev.os.toUpperCase()}</span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {dev.ip}:{dev.port}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-500">PIN {dev.pin}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isPaired ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnpair(dev.id)}
                                  className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:border-red-500/50 hover:text-red-300 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  {t('unpairDevice')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPairingTarget(dev);
                                    setPinInput('');
                                    setPinError(false);
                                  }}
                                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  {t('pairDevice')}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Sharing Capabilities Panel */}
                <aside className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col gap-4">
                  <h2 className="text-base font-semibold text-slate-100 text-start">
                    {t('features')}
                  </h2>

                  <div className="flex flex-col gap-2.5">
                    {[
                      { key: 'input', label: t('shareInput'), icon: Keyboard },
                      { key: 'clipboard', label: t('shareClipboard'), icon: Clipboard },
                      { key: 'files', label: t('shareFiles'), icon: FolderSync },
                      { key: 'audio', label: t('shareAudio'), icon: Volume2 },
                    ].map(({ key, label, icon: Icon }) => {
                      const k = key as keyof SharingFeatures;
                      const active = features[k];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFeatures((f) => ({ ...f, [k]: !f[k] }))}
                          className={`flex items-center justify-between gap-3 p-3.5 rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                              : 'bg-[#0B101B] border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 text-xs font-medium text-start">
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                active ? 'text-emerald-400' : 'text-slate-500'
                              }`}
                            />
                            <span>{label}</span>
                          </span>
                          <span
                            className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${
                              active ? 'bg-emerald-500' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                                active ? 'end-0.5' : 'start-0.5'
                              }`}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
              </div>

              <TopologyCanvas
                localInfo={localInfo}
                pairedDevices={pairedDevices}
                onChangeEdge={handleChangeEdge}
                inputEnabled={features.input}
              />
            </>
          )}

          {activeTab === 'quic' && (
            <QuicWorkbench
              localInfo={localInfo}
              devices={devices}
              pairedIds={pairedIds}
            />
          )}

          {activeTab === 'input' && (
            <InputBridgeWorkbench pairedDevices={pairedDevices} features={features} />
          )}

          {activeTab === 'locales' && <LocaleInspector />}
        </main>
      </div>

      {/* PIN Pairing Modal */}
      {pairingTarget && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0F1623] border border-slate-700 rounded-xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="text-base font-semibold text-white text-start">
              {t('pinModalTitle')}
            </h3>
            <p className="text-xs text-slate-400 text-start leading-relaxed">
              {pairingTarget.name} ({pairingTarget.ip}) — {t('pinModalDesc')}
            </p>
            <div className="text-xs font-mono text-emerald-400/90 text-start" dir="ltr">
              PIN: {pairingTarget.pin}
            </div>
            <input
              type="text"
              maxLength={6}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ''));
                setPinError(false);
              }}
              placeholder="000000"
              dir="ltr"
              className="w-full text-center tracking-[0.4em] text-2xl font-mono tabular-nums bg-[#090D16] border border-slate-700 rounded-lg py-3 text-white focus:border-emerald-500 focus:outline-none"
            />
            {pinError && (
              <p className="text-xs text-red-400 text-start">
                PIN ({pairingTarget.pin})
              </p>
            )}
            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setPairingTarget(null);
                  setPinInput('');
                  setPinError(false);
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmPair}
                disabled={pinInput.length < 6}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white cursor-pointer"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
