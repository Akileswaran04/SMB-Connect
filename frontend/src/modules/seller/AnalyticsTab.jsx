/**
 * Seller analytics — built from the seller's real orders, offers and
 * messages (sellers/insights, analytics summary, trust score). Each measure
 * gets its own single-series chart (no dual axes), with hover tooltips and a
 * table view.
 */
import { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { sellerInsights, trustScore } from '../../services/smb';
import { getSellerAnalytics } from '../../services/storage';
import { PageHeader, Stat, Card, Loading, Empty, Select } from '../../components/ui';
import { inr, dateShort, titleCase } from '../../utils/format';

const MARK = '#00897b'; // brand teal, validated for data marks on white
const SENTIMENT = { positive: '#2a78d6', neutral: '#b8b7b1', negative: '#d0453f' };
const axis = { stroke: '#6d7a77', fontSize: 12 };

function ChartTip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 shadow-lg text-label-md">
      <p className="text-on-surface-variant">{label}</p>
      <p className="font-semibold text-on-surface">{money ? inr(payload[0].value) : payload[0].value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, rows, columns, children }) {
  const [table, setTable] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h2 className="text-title-sm font-semibold text-on-surface">{title}</h2>
          {subtitle && <p className="text-label-sm text-on-surface-variant">{subtitle}</p>}
        </div>
        {rows.length > 0 && <button onClick={() => setTable((t) => !t)} className="text-label-sm text-primary">{table ? 'Show chart' : 'Show table'}</button>}
      </div>
      {rows.length === 0 ? <Empty icon="bar_chart" title="No data for this period" /> : table ? (
        <table className="w-full text-label-md">
          <thead className="text-left text-on-surface-variant"><tr>{columns.map((c) => <th key={c.key} className="py-1">{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-outline-variant/60">{columns.map((c) => <td key={c.key} className="py-1">{c.format ? c.format(r[c.key]) : r[c.key]}</td>)}</tr>)}</tbody>
        </table>
      ) : children}
    </Card>
  );
}

function SeriesBars({ data, dataKey, money, height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="#e2e8f8" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: '#bcc9c6' }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={money ? 64 : 32} allowDecimals={false}
          tickFormatter={(v) => (money ? `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : v)} />
        <Tooltip content={<ChartTip money={money} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey={dataKey} fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function HBars({ rows, labelKey, valueKey, money }) {
  const max = Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r[labelKey]} className="text-label-md" title={`${r[labelKey]}: ${money ? inr(r[valueKey]) : r[valueKey]}`}>
          <div className="flex justify-between gap-2"><span className="text-on-surface truncate">{r[labelKey]}</span><span className="text-on-surface-variant">{money ? inr(r[valueKey]) : r[valueKey]}</span></div>
          <div className="h-2.5 mt-1 bg-surface-container rounded"><div className="h-full rounded" style={{ width: `${(r[valueKey] / max) * 100}%`, background: MARK }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsTab({ seller }) {
  const [days, setDays] = useState(30);
  const [ins, setIns] = useState(null);
  const [summary, setSummary] = useState(null);
  const [trust, setTrust] = useState(null);

  useEffect(() => {
    setIns(null);
    sellerInsights(days).then(setIns).catch(() => setIns({ daily: [], top_products: [], top_buyers: [], messages_by_source: {}, buyer_sentiment: {}, negotiation: {} }));
  }, [days]);
  useEffect(() => {
    getSellerAnalytics(seller.id).then(setSummary);
    trustScore(seller.id).then(setTrust).catch(() => {});
  }, [seller.id]);

  if (!ins) return <Loading />;
  const daily = ins.daily.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }));
  const sources = Object.entries(ins.messages_by_source || {}).map(([k, v]) => ({ source: titleCase(k), messages: v }));
  const sentiment = ['positive', 'neutral', 'negative'].map((k) => ({ key: k, value: ins.buyer_sentiment?.[k] || 0 }));
  const sentimentTotal = sentiment.reduce((a, b) => a + b.value, 0);
  const offers = Object.values(ins.negotiation || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" subtitle="Sales, buyers and conversations — from your real orders and messages."
        actions={(
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option>
          </Select>
        )} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon="currency_rupee" tone="green" label={`Revenue (${days} days)`} value={inr(ins.revenue)} />
        <Stat icon="receipt_long" label="Orders" value={ins.orders} note={`Average order ${inr(ins.average_order_value)}`} />
        <Stat icon="verified" tone="blue" label="Trust score" value={trust ? Math.round(trust.overall_score) : '—'} note={trust ? `Reviews ${Math.round(trust.review_score)} · cancellations ${Math.round((trust.cancellation_rate || 0) * 100)}%` : null} />
        <Stat icon="sell" tone="purple" label="Offers received" value={offers} note={offers ? `${ins.negotiation.accepted || 0} accepted` : null} />
      </div>
      {summary && (
        <p className="text-label-sm text-on-surface-variant">
          All time: {summary.total_orders} orders · {inr(summary.total_revenue)} revenue · {Math.round((summary.conversion_rate || 0) * 100)}% completed
          {summary.response_time_avg ? ` · replies in ~${Math.round(summary.response_time_avg / 60)} min on average` : ''}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue per day" rows={daily} columns={[{ key: 'label', label: 'Day' }, { key: 'revenue', label: 'Revenue', format: inr }]}>
          <SeriesBars data={daily} dataKey="revenue" money />
        </ChartCard>
        <ChartCard title="Orders per day" rows={daily} columns={[{ key: 'label', label: 'Day' }, { key: 'orders', label: 'Orders' }]}>
          <SeriesBars data={daily} dataKey="orders" />
        </ChartCard>
        <ChartCard title="Top products" subtitle="By revenue" rows={ins.top_products} columns={[{ key: 'name', label: 'Product' }, { key: 'units', label: 'Units' }, { key: 'revenue', label: 'Revenue', format: inr }]}>
          <HBars rows={ins.top_products} labelKey="name" valueKey="revenue" money />
        </ChartCard>
        <ChartCard title="Top buyers" rows={ins.top_buyers} columns={[{ key: 'name', label: 'Buyer' }, { key: 'orders', label: 'Orders' }, { key: 'spent', label: 'Spent', format: inr }, { key: 'last_order', label: 'Last order', format: dateShort }]}>
          <HBars rows={ins.top_buyers} labelKey="name" valueKey="spent" money />
        </ChartCard>
        <ChartCard title="Messages by channel" subtitle={`${ins.messages} messages`} rows={sources} columns={[{ key: 'source', label: 'Channel' }, { key: 'messages', label: 'Messages' }]}>
          <HBars rows={sources} labelKey="source" valueKey="messages" />
        </ChartCard>
        <ChartCard title="Buyer sentiment" subtitle="Tone of buyers' messages" rows={sentimentTotal ? sentiment : []} columns={[{ key: 'key', label: 'Tone', format: titleCase }, { key: 'value', label: 'Messages' }]}>
          <div className="flex h-7 rounded overflow-hidden gap-[2px]" role="img" aria-label={sentiment.map((s) => `${s.key} ${s.value}`).join(', ')}>
            {sentiment.filter((s) => s.value).map((s) => (
              <div key={s.key} title={`${titleCase(s.key)}: ${s.value}`} style={{ width: `${(s.value / sentimentTotal) * 100}%`, background: SENTIMENT[s.key] }} />
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-label-md">
            {sentiment.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-on-surface">
                <span className="w-3 h-3 rounded-sm" style={{ background: SENTIMENT[s.key] }} />
                {titleCase(s.key)} <span className="text-on-surface-variant">{sentimentTotal ? Math.round((s.value / sentimentTotal) * 100) : 0}%</span>
              </span>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
