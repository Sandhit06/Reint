import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, BarChart, Bar, LineChart, ReferenceLine,
} from 'recharts';
import {
  Activity, ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown,
  CircleHelp, Clock3, Cloud, Database, Gauge, Layers3, Leaf, Moon, RefreshCw,
  ShieldCheck, SlidersHorizontal, Sun, Wind,
} from 'lucide-react';
import { fetchDayAheadAnalysis, fetchForecastEvolution } from './services/apiClient';
import { DayAheadAnalysisResponse, ForecastEvolutionResponse } from './types/api';

type View = 'desk' | 'accuracy' | 'architecture';
const gates = [
  { value: '09:20', name: 'EPEX 60 min', auction: 'EPEX · 60 min' },
  { value: '09:50', name: 'N2EX hourly', auction: 'N2EX · Hourly' },
  { value: '11:00', name: 'Desk standard', auction: 'Trading desk' },
  { value: '15:30', name: 'EPEX 30 min', auction: 'EPEX · 30 min' },
  { value: '17:30', name: 'Intraday 1', auction: 'Intraday 1' },
];
const riskOptions = [
  { value: 'P50', label: 'P50', detail: 'Median shortfall · 1 in 2 intervals', triggerLabel: 'P50 · Median' },
  { value: 'P75', label: 'P75', detail: 'Covers 3 in 4 observed shortfalls', triggerLabel: 'P75 · 75% coverage' },
  { value: 'P90', label: 'P90', detail: 'Covers 9 in 10 observed shortfalls', triggerLabel: 'P90 · 90% coverage' },
  { value: 'P95', label: 'P95', detail: 'Covers 19 in 20 observed shortfalls', triggerLabel: 'P95 · 95% coverage' },
  { value: 'P99', label: 'P99', detail: 'Covers 99 in 100 observed shortfalls', triggerLabel: 'P99 · 99% coverage' },
];
const fmt = (v: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(v);

type SelectOption = { value: string; label: string; detail?: string; triggerLabel?: string };

function SelectField({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: SelectOption[]; onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');

  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [open]);

  const choose = (index: number) => {
    onChange(options[index].value);
    setActiveIndex(index);
    setOpen(false);
  };

  const openAt = (index: number) => {
    const bounds = rootRef.current?.getBoundingClientRect();
    const menuHeight = Math.min(270, options.length * 52 + 10);
    if (bounds) {
      const below = window.innerHeight - bounds.bottom;
      const above = bounds.top;
      setPlacement(below < menuHeight + 12 && above > below ? 'top' : 'bottom');
    }
    setActiveIndex(index);
    setOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        openAt(selectedIndex);
      } else {
        setActiveIndex((current) => (current + delta + options.length) % options.length);
      }
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      openAt(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex);
      else openAt(selectedIndex);
    }
  };

  const selected = options[selectedIndex];
  const listboxId = `${id}-options`;

  return <div ref={rootRef} className={`custom-select${open ? ' open' : ''}`}>
    <button
      type="button"
      className="custom-select-trigger"
      role="combobox"
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
      onClick={() => { if (open) setOpen(false); else openAt(selectedIndex); }}
      onKeyDown={handleKeyDown}
    >
      <span>{selected.triggerLabel ?? selected.label}</span>
      <ChevronDown size={15} aria-hidden="true"/>
    </button>
    <div id={listboxId} className={`custom-select-menu${placement === 'top' ? ' menu-up' : ''}`} role="listbox" aria-label={label} hidden={!open}>
      {options.map((option, index) => <div
        key={option.value}
        id={`${id}-option-${index}`}
        className="custom-select-option"
        role="option"
        aria-selected={option.value === value}
        data-active={index === activeIndex}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(index)}
      >
        <span className="custom-option-copy"><span className="custom-option-label">{option.label}</span>{option.detail && <small>{option.detail}</small>}</span>
        {option.value === value && <Check size={15} aria-hidden="true"/>}
      </div>)}
    </div>
  </div>;
}

function Metric({ label, value, detail, tone = 'mint', icon: Icon }: {
  label: string; value: React.ReactNode; detail: React.ReactNode; tone?: string;
  icon: React.ElementType;
}) {
  return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div><strong>{value}</strong><div className="metric-detail">{detail}</div></article>;
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const explicitTheme = window.localStorage.getItem('reint-appearance-preference');
    return explicitTheme === 'light' || explicitTheme === 'dark' ? explicitTheme : 'dark';
  });
  const [cutoffTime, setCutoffTime] = useState('11:00');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-31');
  const [confidenceLevel, setConfidenceLevel] = useState('P90');
  const [maxLeadHours, setMaxLeadHours] = useState(48);
  const [activeTab, setActiveTab] = useState<View>('desk');
  const [data, setData] = useState<DayAheadAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const [scorecardData, setScorecardData] = useState<Array<{ gate: string; auction: string; run: string; mae: number; bias: number; p90: number; p95: number }>>([]);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [scorecardError, setScorecardError] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [forecastEvolution, setForecastEvolution] = useState<ForecastEvolutionResponse | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionError, setEvolutionError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchDayAheadAnalysis({ cutoffTime, dateFrom, dateTo, confidenceLevel, maxLeadHours })
      .then((res) => { if (mounted) { setData(res); setError(null); } })
      .catch((err) => { if (mounted) setError(err.message || 'Could not load the analysis.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [cutoffTime, dateFrom, dateTo, confidenceLevel, maxLeadHours, requestKey]);

  useEffect(() => {
    if (activeTab !== 'accuracy') return;
    let mounted = true;
    setScorecardLoading(true);
    setScorecardError(false);
    Promise.all(gates.map(async (gate) => {
      const result = await fetchDayAheadAnalysis({ cutoffTime: gate.value, dateFrom, dateTo, confidenceLevel: 'P90', maxLeadHours });
      const publicationTimes = new Map<string, number>();
      result.records.forEach((record) => {
        const time = record.publishTime.slice(11, 16);
        publicationTimes.set(time, (publicationTimes.get(time) ?? 0) + 1);
      });
      const run = [...publicationTimes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      return { gate: gate.value, auction: gate.auction, run, mae: result.metrics.maeMW, bias: result.metrics.mbeBiasMW, p90: result.metrics.p90ShortfallMW, p95: result.metrics.p95ShortfallMW };
    })).then((rows) => { if (mounted) setScorecardData(rows); })
      .catch(() => { if (mounted) setScorecardError(true); })
      .finally(() => { if (mounted) setScorecardLoading(false); });
    return () => { mounted = false; };
  }, [activeTab, dateFrom, dateTo, maxLeadHours, requestKey]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const step = data.records.length > 350 ? 2 : 1;
    return data.records.filter((_, idx) => idx % step === 0).map((r) => ({
      ...r,
      label: new Date(r.startTime).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    }));
  }, [data]);
  const selectedGate = gates.find((g) => g.value === cutoffTime)?.name ?? 'Custom cutoff';
  const lastRecord = data?.records[data.records.length - 1];
  const selectedRecord = data?.records.find((record) => record.startTime === selectedStartTime) ?? lastRecord;
  const selectedRecordIndex = data && selectedRecord ? Math.max(0, data.records.findIndex((record) => record.startTime === selectedRecord.startTime)) : 0;
  const vintageChartData = useMemo(() => {
    if (!forecastEvolution || !selectedRecord) return [];
    return forecastEvolution.revisions.map((revision) => ({
      ...revision,
      selectedForecastMW: revision.publishTime === selectedRecord.publishTime ? revision.forecastGenerationMW : null,
    }));
  }, [forecastEvolution, selectedRecord?.publishTime]);

  useEffect(() => {
    if (activeTab !== 'desk' || !selectedRecord) return;
    let mounted = true;
    setEvolutionLoading(true);
    setEvolutionError(false);
    setForecastEvolution(null);
    fetchForecastEvolution(selectedRecord.startTime)
      .then((result) => { if (mounted) setForecastEvolution(result); })
      .catch(() => { if (mounted) setEvolutionError(true); })
      .finally(() => { if (mounted) setEvolutionLoading(false); });
    return () => { mounted = false; };
  }, [activeTab, selectedRecord?.startTime]);

  const chartPalette = theme === 'light'
    ? { grid: '#dce6de', axis: '#66766a', actual: '#24804f', forecast: '#5e77b1', tooltip: '#ffffff', tooltipText: '#24372b', tooltipMuted: '#617267', legend: '#4e6155' }
    : { grid: '#ffffff0d', axis: '#738091', actual: '#61d9ae', forecast: '#93b7ff', tooltip: 'rgba(18,27,34,.96)', tooltipText: '#eff8f4', tooltipMuted: '#aab8b2', legend: '#a7b2ad' };

  return <div className="app-shell" data-theme={theme}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="REint home"><span className="brand-mark"><Wind size={20}/></span><span className="brand-name">reint<span>.</span></span><span className="brand-divider"/><span className="brand-product">Market intelligence</span></a>
      <div className="topbar-right"><span className="dataset-status"><i/> Snapshot data · Jan 2026</span><span className="topbar-separator"/><button className="icon-button" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`} onClick={() => { const nextTheme = theme === 'dark' ? 'light' : 'dark'; window.localStorage.setItem('reint-appearance-preference', nextTheme); setTheme(nextTheme); }}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><a className="icon-button help-button" href="https://developer.data.elexon.co.uk/" target="_blank" rel="noreferrer" title="Elexon Insights API documentation" aria-label="Elexon Insights API documentation"><CircleHelp size={18}/></a></div>
    </header>

    <main id="top" className="main-content">
      <section className="intro-row">
        <div><div className="eyebrow"><span className="eyebrow-line"/> UK POWER MARKETS <span className="eyebrow-dot">·</span> WIND DESK</div><h1>Day-ahead <em>decision desk</em></h1><p className="intro-copy">Forecast confidence, quantified. Make the next procurement call with a clear view of wind supply risk.</p></div>
        <div className="period-badge"><CalendarDays size={15}/><span>Analysis period</span><strong>01 — 31 Jan 2026</strong></div>
      </section>

      <nav className="view-switcher" aria-label="Dashboard views">
        <button className={activeTab === 'desk' ? 'active' : ''} onClick={() => setActiveTab('desk')}><Gauge size={16}/>Decision desk</button>
        <button className={activeTab === 'accuracy' ? 'active' : ''} onClick={() => setActiveTab('accuracy')}><Activity size={16}/>Forecast accuracy</button>
        <button className={activeTab === 'architecture' ? 'active' : ''} onClick={() => setActiveTab('architecture')}><Layers3 size={16}/>System overview</button>
      </nav>

      <section className="control-panel glass-panel">
        <div className="control-heading"><div><SlidersHorizontal size={16}/><span>Decision parameters</span></div><span className="control-caption">Adjust the view to your desk</span></div>
        <div className="control-grid">
          <div className="field"><span>Gate closure <small>UTC · D−1</small></span><SelectField id="gate-closure" label="Gate closure" value={cutoffTime} onChange={setCutoffTime} options={gates.map((gate) => ({ value: gate.value, label: gate.value, detail: gate.name, triggerLabel: `${gate.value} · ${gate.name}` }))}/></div>
          <label className="field"><span>Delivery from</span><input type="date" min="2026-01-01" max={dateTo} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}/></label>
          <label className="field"><span>Delivery to</span><input type="date" min={dateFrom} max="2026-01-31" value={dateTo} onChange={(e) => setDateTo(e.target.value)}/></label>
          <div className="field"><span>Risk tolerance</span><SelectField id="risk-tolerance" label="Risk tolerance" value={confidenceLevel} onChange={setConfidenceLevel} options={riskOptions}/></div>
          <label className="field horizon-field"><span>Forecast horizon <b>{maxLeadHours}h</b></span><input aria-label="Maximum forecast horizon" type="range" min={12} max={48} step={6} value={maxLeadHours} onChange={(e) => setMaxLeadHours(Number(e.target.value))}/><span className="range-labels"><small>12h</small><small>48h</small></span></label>
        </div>
      </section>

      <div className="section-meta"><div className="section-context"><Clock3 size={14}/><span>{cutoffTime} UTC</span><span className="meta-divider">/</span><span>{selectedGate}</span><span className="meta-divider">/</span><span>{dateFrom} — {dateTo}</span></div><div className={`live-state ${loading ? 'loading' : error ? 'error' : ''}`}>{loading ? <><RefreshCw size={13} className="spin"/>Updating analysis</> : error ? <><i/>Service unavailable</> : <><i/>Analysis ready</>}</div></div>

      {error && <div className="error-panel"><div><strong>We couldn’t load the latest analysis.</strong><span>{error}</span></div><button onClick={() => { setError(null); setLoading(true); setRequestKey((v) => v + 1); }}><RefreshCw size={14}/> Retry</button></div>}
      {data && <>
        <section className="metrics-grid" aria-label="Forecast performance summary">
          <Metric label="Mean absolute error" value={<>{fmt(data.metrics.maeMW)} <small>MW</small></>} detail={<>Across {fmt(data.metrics.count)} settlement periods <span className="detail-accent">·</span> MAPE {data.metrics.mapePercent}%</>} icon={Activity}/>
          <Metric label="Forecast bias" value={<>{data.metrics.mbeBiasMW > 0 ? '+' : ''}{fmt(data.metrics.mbeBiasMW)} <small>MW</small></>} detail={<>Over-forecast on <b>{data.metrics.shortfallFrequencyPercent}%</b> of intervals</>} tone="amber" icon={data.metrics.mbeBiasMW >= 0 ? ArrowUpRight : ArrowDownRight}/>
          <Metric label={`${confidenceLevel} wind shortfall buffer`} value={<>{fmt(data.metrics.recommendedThermalBufferMW)} <small>MW</small></>} detail={<>Wind cover only · excludes demand procurement</>} tone="mint-strong" icon={ShieldCheck}/>
          <Metric label="Root mean square error" value={<>{fmt(data.metrics.rmseMW)} <small>MW</small></>} detail={<>Tail-sensitive error <span className="detail-accent">·</span> {confidenceLevel} Pctl {fmt(confidenceLevel === 'P99' ? data.metrics.p99ShortfallMW : confidenceLevel === 'P95' ? data.metrics.p95ShortfallMW : data.metrics.p90ShortfallMW)} MW</>} tone="blue" icon={Gauge}/>
        </section>

        {activeTab === 'desk' && <>
          <section className="chart-card glass-panel">
            <div className="card-heading"><div><div className="eyebrow small-eyebrow">DELIVERY PROFILE</div><h2>Wind supply <span>vs</span> forecast</h2><p>Latest forecast available at gate closure compared with metered outturn.</p></div><div className="chart-range"><span className="range-dot"/> {data.records.length} half-hour periods</div></div>
            <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 14, right: 12, bottom: 0, left: 0 }} onClick={(event: { activePayload?: Array<{ payload?: { startTime?: string } }> } | undefined) => { const startTime = event?.activePayload?.[0]?.payload?.startTime; if (startTime) setSelectedStartTime(startTime); }}>
              <defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#61d9ae" stopOpacity={0.25}/><stop offset="95%" stopColor="#61d9ae" stopOpacity={0.015}/></linearGradient></defs>
              <CartesianGrid stroke={chartPalette.grid} vertical={false}/><XAxis dataKey="label" stroke={chartPalette.axis} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={42}/><YAxis stroke={chartPalette.axis} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={(v: number) => `${Math.round(v/1000)}k`}/>
              <Tooltip contentStyle={{ background: chartPalette.tooltip, border: `1px solid ${theme === 'light' ? '#d5e1d8' : 'rgba(255,255,255,.12)'}`, borderRadius: 12, color: chartPalette.tooltipText, boxShadow: '0 14px 40px #0002' }} labelStyle={{ color: chartPalette.tooltipMuted, marginBottom: 6 }} formatter={(value: number, name: string) => [`${fmt(value)} MW`, name]}/><Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 11, color: chartPalette.legend, paddingBottom: 12 }}/>
              <Area type="monotone" dataKey="actualGenerationMW" name="Actual wind" stroke={chartPalette.actual} strokeWidth={2} fill="url(#actualFill)" activeDot={{ r: 4, strokeWidth: 0 }}/><Line type="monotone" dataKey="forecastGenerationMW" name="Day-ahead forecast" stroke={chartPalette.forecast} strokeWidth={1.8} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>
            </ComposedChart></ResponsiveContainer></div>
            <div className="delivery-scrubber"><div className="delivery-scrubber-label"><label htmlFor="delivery-interval">Explore a delivery interval</label><output htmlFor="delivery-interval">{selectedRecord ? new Date(selectedRecord.startTime).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC · SP ' + selectedRecord.settlementPeriod : '—'}</output></div><input id="delivery-interval" aria-label="Explore a delivery interval" type="range" min={0} max={Math.max(0, data.records.length - 1)} step={1} value={selectedRecordIndex} onChange={(event) => setSelectedStartTime(data.records[Number(event.target.value)].startTime)}/><div className="delivery-scrubber-ends"><span>{data.records[0]?.settlementDate ?? dateFrom}</span><span>{data.records[data.records.length - 1]?.settlementDate ?? dateTo}</span></div></div>
            <div className="chart-footnote"><span><Cloud size={14}/> Elexon BMRS · FUELHH + WINDFOR · select a point or scrub to replay its forecast vintages</span><span>All timestamps UTC</span></div>
          </section>
          <section className="vintage-card glass-panel" aria-label="Forecast vintage replay">
            <div className="vintage-heading"><div><div className="eyebrow small-eyebrow">POINT-IN-TIME AUDIT</div><h2>Forecast vintage replay</h2><p>See which publication the desk could use, and how later forecasts revised before delivery.</p></div><span className="vintage-period">{selectedRecord ? new Date(selectedRecord.startTime).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : 'Choose a chart interval'}</span></div>
            {selectedRecord && <div className="vintage-layout">
              <div className="vintage-chart-wrap">
                {evolutionLoading ? <div className="vintage-state"><RefreshCw size={14} className="spin"/> Loading publication history…</div> : evolutionError ? <div className="vintage-state">Could not load forecast publication history for this interval.</div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={vintageChartData} margin={{ top: 18, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={chartPalette.grid} vertical={false}/>
                  <XAxis dataKey="publishTime" stroke={chartPalette.axis} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={26} tickFormatter={(value: string) => value.slice(11, 16)}/>
                  <YAxis stroke={chartPalette.axis} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={44} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}/>
                  <Tooltip contentStyle={{ background: chartPalette.tooltip, border: `1px solid ${theme === 'light' ? '#d5e1d8' : 'rgba(255,255,255,.12)'}`, borderRadius: 12, color: chartPalette.tooltipText }} labelStyle={{ color: chartPalette.tooltipMuted, marginBottom: 6 }} labelFormatter={(value: string) => `${value.replace('T', ' ').slice(0, 16)} UTC`} formatter={(value: number, name: string) => [`${fmt(value)} MW`, name]}/>
                  <ReferenceLine y={selectedRecord.actualGenerationMW} stroke={chartPalette.actual} strokeDasharray="4 4" label={{ value: 'Observed', fill: chartPalette.actual, fontSize: 9, position: 'insideTopRight' }}/>
                  <ReferenceLine x={selectedRecord.publishTime} stroke={chartPalette.forecast} strokeDasharray="3 4"/>
                  <Line type="monotone" dataKey="forecastGenerationMW" name="Forecast vintage" stroke={chartPalette.forecast} strokeWidth={2} dot={{ r: 2, fill: chartPalette.forecast, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }}/>
                  <Line type="monotone" dataKey="selectedForecastMW" name="Used at gate closure" stroke="transparent" dot={{ r: 5, fill: theme === 'light' ? '#28764e' : '#75d9b5', stroke: chartPalette.tooltip, strokeWidth: 2 }} activeDot={false}/>
                </LineChart></ResponsiveContainer>}
              </div>
              <div className="vintage-summary">
                <div className="vintage-selected"><span className="vintage-dot"/><div><small>Vintage used at {cutoffTime} UTC</small><b>{selectedRecord.publishTime.slice(11, 16)} UTC · {selectedRecord.leadHours.toFixed(1)}h lead</b><span>{forecastEvolution?.revisions.filter((revision) => revision.publishTime <= selectedRecord.publishTime).length ?? '—'} revisions available by cutoff</span></div></div>
                <div className="vintage-values"><span><small>Observed outturn</small><b>{fmt(selectedRecord.actualGenerationMW)} <i>MW</i></b></span><span><small>Forecast at cutoff</small><b>{fmt(selectedRecord.forecastGenerationMW)} <i>MW</i></b></span><span><small>Wind shortfall</small><b>{fmt(selectedRecord.shortfallMW)} <i>MW</i></b></span></div>
                <p className="vintage-note">The highlighted publication is the one scored for this gate. Later revisions are shown for context and are excluded from the decision-time result.</p>
              </div>
            </div>}
          </section>
          <section className="bottom-grid">
            <div className="insight-card glass-panel"><div className="insight-icon"><Leaf size={18}/></div><div><div className="eyebrow small-eyebrow">WIND SHORTFALL POSITION</div><h3>Forecast shortfall buffer</h3><p>At <b>{confidenceLevel}</b> confidence, the historical wind shortfall buffer is <strong>{fmt(data.metrics.recommendedThermalBufferMW)} MW</strong>. This is wind risk context only; total procurement also depends on demand.</p></div></div>
            <div className="snapshot-card glass-panel"><div><div className="eyebrow small-eyebrow">SELECTED DELIVERY INTERVAL</div><h3>{selectedRecord ? new Date(selectedRecord.startTime).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : 'No interval selected'}</h3></div><div className="snapshot-values"><span><small>Actual</small><b>{selectedRecord ? fmt(selectedRecord.actualGenerationMW) : '—'} <i>MW</i></b></span><span><small>Forecast</small><b>{selectedRecord ? fmt(selectedRecord.forecastGenerationMW) : '—'} <i>MW</i></b></span><span className="snapshot-delta"><small>Error</small><b>{selectedRecord ? `${selectedRecord.errorMW > 0 ? '+' : ''}${fmt(selectedRecord.errorMW)}` : '—'} <i>MW</i></b></span></div></div>
          </section>
        </>}

        {activeTab === 'accuracy' && <>
          <section className="chart-card glass-panel">
            <div className="card-heading"><div><div className="eyebrow small-eyebrow">FORECAST SKILL</div><h2>Error grows with <em>lead time</em></h2><p>Average absolute error by time between forecast publication and delivery.</p></div><div className="chart-range">January 2026 <span className="meta-divider">·</span> MW</div></div>
            <div className="chart-wrap horizon-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.horizonCurve} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}><CartesianGrid stroke={chartPalette.grid} vertical={false}/><XAxis dataKey="horizonLabel" stroke={chartPalette.axis} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/><YAxis stroke={chartPalette.axis} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50}/><Tooltip contentStyle={{ background: chartPalette.tooltip, border: `1px solid ${theme === 'light' ? '#d5e1d8' : 'rgba(255,255,255,.12)'}`, borderRadius: 12, color: chartPalette.tooltipText }} formatter={(value: number) => [`${fmt(value)} MW`]}/><Bar dataKey="maeMW" name="MAE" fill={theme === 'light' ? '#2c8857' : '#76d8b3'} radius={[6,6,0,0]} maxBarSize={38}/><Bar dataKey="p90ShortfallMW" name="P90 shortfall" fill={theme === 'light' ? '#647fb9' : '#728fca'} radius={[6,6,0,0]} maxBarSize={38}/></BarChart></ResponsiveContainer></div>
          </section>
          <section className="table-card glass-panel"><div className="table-heading"><div><div className="eyebrow small-eyebrow">GATE CLOSURE SCORECARD</div><h2>Accuracy by decision cutoff</h2></div><p>Each row is recalculated from the selected date range using the latest forecast available by that gate.</p></div><div className="table-scroll"><table><thead><tr><th>Decision cutoff</th><th>Most-used publish time</th><th>MAE</th><th>Mean bias</th><th>P90 cover</th><th>P95 cover</th></tr></thead><tbody>{scorecardLoading && <tr><td colSpan={6}>Calculating gate closure comparisons…</td></tr>}{scorecardError && <tr><td colSpan={6}>Could not load the gate closure comparison.</td></tr>}{!scorecardLoading && !scorecardError && scorecardData.map((row) => <tr key={row.gate} className={cutoffTime === row.gate ? 'selected-row' : ''}><td><b>{row.gate}</b><small>{row.auction}</small></td><td>{row.run} UTC</td><td>{row.mae.toFixed(1)} MW</td><td className={row.bias > 0 ? 'warm' : ''}>{row.bias > 0 ? '+' : ''}{row.bias.toFixed(1)} MW</td><td>{fmt(row.p90)} MW</td><td>{fmt(row.p95)} MW</td></tr>)}</tbody></table></div><div className="table-note"><Check size={14}/> WINDFOR publication cadence is taken from each response; later cutoffs only improve the comparison when a newer run is available before closure.</div></section>
        </>}

        {activeTab === 'architecture' && <section className="architecture-view">
          <div className="architecture-intro glass-panel"><div className="architecture-symbol"><Layers3 size={22}/></div><div><div className="eyebrow small-eyebrow">SYSTEM OVERVIEW</div><h2>From forecast publication to trading decision</h2><p>A point-in-time analytics pipeline aligns public wind forecasts with observed generation, then surfaces the risk in a desk-ready view.</p></div></div>
          <div className="architecture-grid"><article className="architecture-card glass-panel"><span className="architecture-number">01</span><span className="architecture-icon"><Database size={19}/></span><h3>Data sources</h3><p>Two Elexon BMRS datasets anchor the analysis.</p><ul><li><b>FUELHH</b><span>Half-hourly metered wind outturn</span></li><li><b>WINDFOR</b><span>Hourly forecast vintages with publish time</span></li><li><b>Jan 2026</b><span>Elexon API snapshot; works offline</span></li></ul><div className="source-links"><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">FUELHH endpoint docs ↗</a><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">WINDFOR endpoint docs ↗</a></div></article>
            <article className="architecture-card glass-panel"><span className="architecture-number">02</span><span className="architecture-icon"><Clock3 size={19}/></span><h3>Point-in-time join</h3><p>Only information available to a trader at the chosen cutoff is eligible.</p><div className="formula">publishTime ≤<br/><strong>D−1 · gate closure</strong></div><div className="architecture-foot">Latest eligible forecast selected for each settlement period.</div></article>
            <article className="architecture-card glass-panel"><span className="architecture-number">03</span><span className="architecture-icon"><ShieldCheck size={19}/></span><h3>Risk translation</h3><p>Signed forecast errors become empirical shortfall buffers at the selected confidence level.</p><ul><li><b>MAE / RMSE</b><span>Forecast error distribution</span></li><li><b>P90 / P95</b><span>Tail shortfall estimates in MW</span></li><li><b>Thermal buffer</b><span>Quantile of wind shortfalls</span></li></ul></article></div>
          <div className="stack-row glass-panel"><span className="stack-label">APPLICATION STACK</span><span><b>React 18</b> · TypeScript · Recharts</span><i/><span><b>FastAPI</b> · Pydantic</span><i/><span><b>Docker</b> · local snapshot</span></div>
        </section>}
      </>}
      {!data && !error && <section className="empty-state glass-panel"><RefreshCw size={18} className="spin"/><span>Aligning January wind forecasts and outturn…</span></section>}

      <footer className="footer"><div><span className="footer-brand">reint<span>.</span></span><span>Decision support for a changing energy system</span></div><div><span><i/> Elexon BMRS snapshot</span><span>January 2026</span><span>MW · UTC</span></div></footer>
    </main>
  </div>;
}

export default App;
