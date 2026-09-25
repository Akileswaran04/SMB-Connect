
import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import { generateId } from '../../../hooks/useLocalStorage';

const periodData = {
  'Last 7 days': [
    { day: 'Mon', messages: 132, engagement: 58, trust: 8.2 },
    { day: 'Tue', messages: 168, engagement: 64, trust: 8.4 },
    { day: 'Wed', messages: 157, engagement: 61, trust: 8.3 },
    { day: 'Thu', messages: 211, engagement: 72, trust: 8.6 },
    { day: 'Fri', messages: 187, engagement: 68, trust: 8.5 },
    { day: 'Sat', messages: 224, engagement: 76, trust: 8.8 },
    { day: 'Sun', messages: 205, engagement: 73, trust: 8.7 },
  ],
  'Last 30 days': [
    { day: 'W1', messages: 540, engagement: 59, trust: 8.1 },
    { day: 'W2', messages: 685, engagement: 64, trust: 8.3 },
    { day: 'W3', messages: 770, engagement: 69, trust: 8.5 },
    { day: 'W4', messages: 846, engagement: 74, trust: 8.7 },
  ],
  'Last 90 days': [
    { day: 'Jan', messages: 1820, engagement: 55, trust: 7.9 },
    { day: 'Feb', messages: 2140, engagement: 61, trust: 8.1 },
    { day: 'Mar', messages: 2510, engagement: 67, trust: 8.4 },
  ],
  'This year': [
    { day: 'Jan', messages: 1820, engagement: 55, trust: 7.9 },
    { day: 'Feb', messages: 2140, engagement: 61, trust: 8.1 },
    { day: 'Mar', messages: 2510, engagement: 67, trust: 8.4 },
    { day: 'Apr', messages: 2740, engagement: 70, trust: 8.5 },
    { day: 'May', messages: 3010, engagement: 73, trust: 8.7 },
    { day: 'Jun', messages: 3280, engagement: 76, trust: 8.8 },
    { day: 'Jul', messages: 3510, engagement: 79, trust: 8.9 },
    { day: 'Aug', messages: 3790, engagement: 81, trust: 9.0 },
  ],
};

const baseSentiment = [
  { name: 'Positive', value: 72, count: 842 },
  { name: 'Neutral', value: 19, count: 222 },
  { name: 'Negative', value: 9, count: 101 },
];

const channels = [
  { name: 'Email', value: 36, count: 420 },
  { name: 'Direct', value: 27, count: 315 },
  { name: 'Portal', value: 22, count: 250 },
  { name: 'Outlook', value: 15, count: 180 },
];

const sentimentColors = { Positive: '#32a66a', Neutral: '#f2b83f', Negative: '#e65353' };
const channelColors = ['#326fe8', '#7a48d4', '#f2b83f', '#2ca6a0'];

function KpiCard({ icon, label, value, change, note }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="material-symbols-outlined text-[20px] text-primary p-2 bg-primary-container/20 rounded-lg">{icon}</span>
        <span className={`text-label-sm font-bold ${change.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>{change}</span>
      </div>
      <p className="text-headline-lg text-on-surface font-bold">{value}</p>
      <p className="text-label-md text-on-surface-variant mt-0.5">{label}</p>
      <p className="text-label-sm text-on-surface-variant/70 mt-1">{note}</p>
    </div>
  );
}

function SentimentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white border border-outline-variant rounded-lg p-3 shadow-lg min-w-[120px]">
      <div className="flex items-center gap-2 text-label-sm font-semibold text-on-surface">
        <span className="w-2 h-2 rounded-full" style={{ background: sentimentColors[item.name] }} />
        {item.name}
      </div>
      <p className="text-headline-sm text-on-surface font-bold mt-1">{item.value}%</p>
      <p className="text-label-sm text-on-surface-variant">{item.count} messages</p>
    </div>
  );
}

export default function AnalyticsTab({ sellerId, onToast }) {
  const [period, setPeriod] = useState('Last 7 days');
  const [channel, setChannel] = useState('All channels');
  const [sentiment, setSentiment] = useState('All sentiments');
  const [buyerSearch, setBuyerSearch] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState(null);

  const chartData = useMemo(() => {
    let data = periodData[period];
    if (channel !== 'All channels') {
      const factor = channel === 'Email' ? 0.82 : channel === 'Direct' ? 0.72 : channel === 'Portal' ? 0.63 : 0.54;
      data = data.map(x => ({ ...x, messages: Math.round(x.messages * factor), engagement: Math.round(x.engagement * (0.9 + factor / 10)) }));
    }
    return data;
  }, [period, channel]);

  const kpis = useMemo(() => {
    const messages = Math.round(chartData.reduce((a, b) => a + b.messages, 0));
    const engagement = Math.round(chartData.reduce((a, b) => a + b.engagement, 0) / chartData.length);
    const avgTrust = (chartData.reduce((a, b) => a + b.trust, 0) / chartData.length).toFixed(1);
    return { messages, engagement, trust: avgTrust };
  }, [chartData]);

  const filteredSentiment = useMemo(() => {
    if (sentiment === 'All sentiments') return baseSentiment;
    return baseSentiment.filter(x => x.name === sentiment);
  }, [sentiment]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold">Business Analytics</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Monitor your communication performance and buyer engagement</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Live analytics
          </span>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex flex-wrap items-center gap-3">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 px-3 rounded-lg border border-outline-variant bg-surface text-label-md text-on-surface focus:border-primary focus:outline-none"
        >
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Last 90 days</option>
          <option>This year</option>
        </select>

        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-9 px-3 rounded-lg border border-outline-variant bg-surface text-label-md text-on-surface focus:border-primary focus:outline-none"
        >
          <option>All channels</option>
          <option>Email</option>
          <option>Direct</option>
          <option>Portal</option>
          <option>Outlook</option>
        </select>

        <select
          value={sentiment}
          onChange={(e) => setSentiment(e.target.value)}
          className="h-9 px-3 rounded-lg border border-outline-variant bg-surface text-label-md text-on-surface focus:border-primary focus:outline-none"
        >
          <option>All sentiments</option>
          <option>Positive</option>
          <option>Neutral</option>
          <option>Negative</option>
        </select>

        <div className="flex items-center gap-2 ml-auto text-label-sm text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Live
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="chat" label="Messages analyzed" value={kpis.messages.toLocaleString()} change="+18.4%" note={`vs previous ${period.toLowerCase()}`} />
        <KpiCard icon="schedule" label="Avg response time" value="15m 42s" change="-8.2%" note="faster than previous period" />
        <KpiCard icon="group" label="Buyer engagement" value={`${kpis.engagement}%`} change="+7.8%" note="interaction engagement rate" />
        <KpiCard icon="shield" label="Average trust score" value={`${kpis.trust}/10`} change="+0.4" note="weighted trust index" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h3 className="text-title-sm text-on-surface font-semibold">Communication Performance</h3>
          <p className="text-label-sm text-on-surface-variant mt-0.5">Message activity and engagement over {period.toLowerCase()}</p>
          <div className="h-[220px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="messages" name="Messages" stroke="#326fe8" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="engagement" name="Engagement %" stroke="#8a4fd6" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h3 className="text-title-sm text-on-surface font-semibold">Channel Activity</h3>
          <p className="text-label-sm text-on-surface-variant mt-0.5">Messages by source</p>
          <div className="h-[160px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channels} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {channels.map((entry, i) => <Cell key={entry.name} fill={channelColors[i]} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}%`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {channels.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-label-sm">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full" style={{ background: channelColors[i] }} />
                  {item.name}
                </span>
                <span className="font-semibold text-on-surface">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h3 className="text-title-sm text-on-surface font-semibold">Sentiment Distribution</h3>
          <p className="text-label-sm text-on-surface-variant mt-0.5">Analyzed communication tone</p>
          <div className="h-[160px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={filteredSentiment} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3}>
                  {filteredSentiment.map(item => <Cell key={item.name} fill={sentimentColors[item.name]} />)}
                </Pie>
                <Tooltip content={<SentimentTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {baseSentiment.map(item => (
              <div key={item.name} className="flex items-center justify-between text-label-sm">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full" style={{ background: sentimentColors[item.name] }} />
                  {item.name}
                </span>
                <span className="font-semibold text-on-surface">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-title-sm text-on-surface font-semibold">Top Buyers by Engagement</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">Based on message frequency and response patterns</p>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">search</span>
            <input
              value={buyerSearch}
              onChange={(e) => setBuyerSearch(e.target.value)}
              placeholder="Search buyers..."
              className="h-9 pl-9 pr-4 rounded-lg border border-outline-variant bg-surface text-label-md text-on-surface focus:border-primary focus:outline-none w-full sm:w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-left text-label-sm text-on-surface-variant font-medium py-2 px-3">BUYER</th>
                <th className="text-left text-label-sm text-on-surface-variant font-medium py-2 px-3">TRUST</th>
                <th className="text-left text-label-sm text-on-surface-variant font-medium py-2 px-3">ENGAGEMENT</th>
                <th className="text-left text-label-sm text-on-surface-variant font-medium py-2 px-3">STATUS</th>
                <th className="text-left text-label-sm text-on-surface-variant font-medium py-2 px-3 hidden sm:table-cell">LAST ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'GreenMart Retail', trust: 9.2, engagement: 'High', status: 'Healthy', last: '12 min ago' },
                { name: 'Apex Distributors', trust: 8.8, engagement: 'High', status: 'Healthy', last: '34 min ago' },
                { name: 'Metro Wholesale', trust: 8.1, engagement: 'Medium', status: 'Watch', last: '1 hr ago' },
                { name: 'Nova Supplies', trust: 7.6, engagement: 'Medium', status: 'Watch', last: '2 hrs ago' },
                { name: 'Urban Basket', trust: 9.0, engagement: 'High', status: 'Healthy', last: '3 hrs ago' },
              ]
                .filter(b => !buyerSearch || b.name.toLowerCase().includes(buyerSearch.toLowerCase()))
                .map(b => (
                  <tr key={b.name} className="border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors">
                    <td className="py-3 px-3">
                      <p className="text-label-md text-on-surface font-medium">{b.name}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-label-md font-bold ${b.trust >= 8.5 ? 'text-emerald-600' : b.trust < 7.5 ? 'text-red-500' : 'text-amber-600'}`}>
                        {b.trust}/10
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-label-sm font-medium ${
                        b.engagement === 'High' ? 'bg-emerald-50 text-emerald-700' :
                        b.engagement === 'Medium' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {b.engagement}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-label-sm font-medium ${
                        b.status === 'Healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-label-sm text-on-surface-variant hidden sm:table-cell">{b.last}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
