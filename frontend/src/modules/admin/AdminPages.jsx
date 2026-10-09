/**
 * Admin pages (PRD §46–51). Every change here is recorded in the audit log
 * on the server.
 */
import { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { admin, listOrders, listShipments, assignPartner, listPartners, listDisputes, resolveDispute, setOrderStatus } from '../../services/smb';
import {
  PageHeader, Stat, Card, Tabs, Loading, Empty, Button, Badge, StatusBadge, Modal, Field, Input, Select, Textarea, Toggle, Icon, inputClass,
} from '../../components/ui';
import { inr, dateShort, dateTime, titleCase } from '../../utils/format';

const MARK = '#00897b';
const ALL_STATUSES = ['seller_confirmed', 'processing', 'packed', 'ready_for_pickup', 'picked_up', 'in_transit', 'out_for_delivery',
  'delivered', 'delivery_failed', 'cancelled', 'return_requested', 'returned', 'refunded'];

function useLoad(fn, deps) {
  const [data, setData] = useState(null);
  const reload = useCallback(async () => {
    setData(null);
    setData(await fn().catch(() => []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return [data, reload];
}

// ── Dashboard (§47) ──
export function AdminDashboard({ go }) {
  const [d] = useLoad(() => admin.dashboard(), []);
  if (!d) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Platform overview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon="shopping_bag" label="Buyers" value={d.total_buyers} onClick={() => go('users')} />
        <Stat icon="storefront" label="Sellers" value={d.total_sellers} note={`${d.active_sellers} active`} onClick={() => go('sellers')} />
        <Stat icon="local_shipping" tone="indigo" label="Delivery partners" value={d.total_logistics} onClick={() => go('users')} />
        <Stat icon="receipt_long" tone="blue" label="Orders" value={d.orders} onClick={() => go('orders')} />
        <Stat icon="currency_rupee" tone="green" label="Revenue collected" value={inr(d.revenue)} note={`${inr(d.platform_fees)} platform fees`} />
        <Stat icon="conveyor_belt" tone="purple" label="Active shipments" value={d.active_shipments} onClick={() => go('shipments')} />
        <Stat icon="verified_user" tone="amber" label="Pending verification" value={d.pending_verification} onClick={() => go('sellers')} />
        <Stat icon="gavel" tone="red" label="Open disputes" value={d.disputes} onClick={() => go('disputes')} />
      </div>
      <Card className="p-4">
        <h2 className="text-title-md font-semibold mb-2">System alerts</h2>
        {d.alerts.length === 0 ? <p className="text-label-md text-on-surface-variant">No alerts — everything is running normally.</p> : (
          <ul className="space-y-1.5">
            {d.alerts.map((a) => (
              <li key={a.message} className="flex items-center gap-2 text-label-md">
                <Badge tone={a.level === 'error' ? 'red' : a.level === 'warning' ? 'amber' : 'blue'}>{titleCase(a.level)}</Badge>{a.message}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── Users (§48) ──
export function AdminUsers({ onToast }) {
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [users, reload] = useLoad(() => admin.users({ role, q: q || undefined }), [role, q]);
  const update = async (u, body, msg) => {
    try { await admin.updateUser(u.id, body); onToast(msg); reload(); } catch (err) { onToast(err.message, 'error'); }
  };
  return (
    <div>
      <PageHeader title="Users" />
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" className={`${inputClass} max-w-xs`} aria-label="Search users" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="max-w-[180px]" aria-label="Role">
          <option value="">All roles</option><option value="buyer">Buyers</option><option value="seller">Sellers</option><option value="logistics">Delivery</option><option value="admin">Admins</option>
        </Select>
      </div>
      {!users ? <Loading /> : users.length === 0 ? <Empty title="No users found" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-label-md">
            <thead className="text-left text-on-surface-variant border-b border-outline-variant"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-outline-variant/60">
                  <td className="p-3"><span className="font-semibold">{u.full_name || '—'}</span><span className="block text-label-sm text-on-surface-variant">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span></td>
                  <td className="p-3">
                    <Select value={u.role} onChange={(e) => update(u, { role: e.target.value }, 'Role updated')} className="h-8 max-w-[130px]" aria-label="Role">
                      {['buyer', 'seller', 'logistics', 'admin'].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                    </Select>
                  </td>
                  <td className="p-3">{dateShort(u.created_at)}</td>
                  <td className="p-3 space-x-1">{u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}{u.is_verified && <Badge tone="blue">Verified</Badge>}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {!u.is_verified && <Button size="sm" variant="ghost" onClick={() => update(u, { is_verified: true }, 'User verified')}>Verify</Button>}
                    {u.is_active
                      ? <Button size="sm" variant="ghost" onClick={() => update(u, { is_active: false }, 'User suspended')}>Suspend</Button>
                      : <Button size="sm" variant="secondary" onClick={() => update(u, { is_active: true }, 'User activated')}>Activate</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Seller verification (§49) ──
export function AdminSellers({ onToast }) {
  const [status, setStatus] = useState('submitted');
  const [sellers, reload] = useLoad(() => admin.sellers(status || undefined), [status]);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const decide = async (decision) => {
    try {
      setDetail(await admin.decideSeller(detail.id, decision, note || null));
      onToast({ approve: 'Seller approved', reject: 'Seller rejected', request_info: 'Information requested from the seller' }[decision]);
      setNote('');
      reload();
    } catch (err) { onToast(err.message, 'error'); }
  };
  return (
    <div>
      <PageHeader title="Sellers & verification" />
      <Tabs value={status} onChange={setStatus} tabs={[{ key: 'submitted', label: 'Awaiting review' }, { key: 'under_review', label: 'Under review' }, { key: 'draft', label: 'Draft / info requested' }, { key: 'verified', label: 'Verified' }, { key: 'rejected', label: 'Rejected' }, { key: '', label: 'All' }]} />
      {!sellers ? <Loading /> : sellers.length === 0 ? <Empty icon="storefront" title="No sellers here" /> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {sellers.map((s) => (
            <Card key={s.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-label-md font-semibold truncate">{s.business_name}</p>
                <p className="text-label-sm text-on-surface-variant">{s.owner_name || s.email} · {s.city || '—'} · {titleCase(s.business_type)}</p>
              </div>
              <StatusBadge status={s.verification_status} />
              <Button size="sm" variant="secondary" onClick={async () => setDetail(await admin.seller(s.id))}>Review</Button>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.business_name} wide
        footer={detail && <>
          <Button variant="secondary" onClick={() => decide('request_info')} disabled={!note.trim()}>Request information</Button>
          <Button variant="danger" onClick={() => decide('reject')} disabled={!note.trim()}>Reject</Button>
          <Button onClick={() => decide('approve')}>Approve</Button>
        </>}>
        {detail && (
          <div className="space-y-3 text-label-md">
            <div className="grid sm:grid-cols-2 gap-2">
              <p><span className="text-on-surface-variant">Status:</span> <StatusBadge status={detail.verification_status} /></p>
              <p><span className="text-on-surface-variant">Owner:</span> {detail.owner_name || '—'}</p>
              <p><span className="text-on-surface-variant">Category:</span> {titleCase(detail.business_type)}</p>
              <p><span className="text-on-surface-variant">License:</span> {detail.license_number || '—'}</p>
              <p><span className="text-on-surface-variant">Phone:</span> {detail.phone || '—'}</p>
              <p><span className="text-on-surface-variant">Email:</span> {detail.email || '—'}</p>
              <p className="sm:col-span-2"><span className="text-on-surface-variant">Address:</span> {detail.address || '—'}</p>
              <p className="sm:col-span-2"><span className="text-on-surface-variant">Payouts:</span> {detail.bank.account_last4 ? `${detail.bank.holder} ••••${detail.bank.account_last4} (${detail.bank.ifsc})` : 'No bank account'}{detail.bank.upi_id ? ` · UPI ${detail.bank.upi_id}` : ''}</p>
              <p><span className="text-on-surface-variant">Products:</span> {detail.product_count} · <span className="text-on-surface-variant">Orders:</span> {detail.order_count}</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Documents</p>
              {detail.documents.length === 0 ? <p className="text-on-surface-variant">No documents submitted.</p> : detail.documents.map((doc) => (
                <p key={doc.id} className="flex flex-wrap items-center gap-2 py-1 border-t border-outline-variant/60">
                  {titleCase(doc.type)} · {doc.reference || 'no reference'} <StatusBadge status={doc.status} />
                  <span className="text-label-sm text-on-surface-variant">submitted {dateShort(doc.submitted_at)}{doc.admin_note ? ` · note: ${doc.admin_note}` : ''}</span>
                </p>
              ))}
            </div>
            <Field label="Note to the seller" hint="Required to reject or request information."><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Products & categories (§50) ──
export function AdminProducts({ onToast }) {
  const [tab, setTab] = useState('reported');
  const [q, setQ] = useState('');
  const [products, reloadProducts] = useLoad(
    () => (tab === 'categories' ? Promise.resolve([]) : tab === 'reports' ? admin.reports('open')
      : admin.products({ reported: tab === 'reported' || undefined, status: tab === 'removed' ? 'deleted' : undefined, q: q || undefined })),
    [tab, q],
  );
  const [cats, reloadCats] = useLoad(() => admin.categories(), []);
  const [newCat, setNewCat] = useState({ name: '', icon: '' });

  const moderate = async (p, status) => {
    const note = status === 'deleted' ? window.prompt('Reason for removal (shown to the seller):') : 'Restored';
    if (status === 'deleted' && !note) return;
    try { await admin.moderateProduct(p.id, status, note); onToast(status === 'deleted' ? 'Product removed' : 'Product restored'); reloadProducts(); } catch (err) { onToast(err.message, 'error'); }
  };
  const resolve = async (r, status, remove) => {
    try { await admin.resolveReport(r.id, { status, note: remove ? 'Removed after report' : 'Reviewed', remove_product: remove }); onToast('Report closed'); reloadProducts(); } catch (err) { onToast(err.message, 'error'); }
  };
  const catAction = async (fn, msg) => { try { await fn(); onToast(msg); reloadCats(); } catch (err) { onToast(err.message, 'error'); } };

  return (
    <div>
      <PageHeader title="Products & categories" />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'reported', label: 'Reported' }, { key: 'reports', label: 'Open reports' }, { key: 'all', label: 'All products' }, { key: 'removed', label: 'Removed' }, { key: 'categories', label: 'Categories' }]} />
      {tab === 'categories' ? (
        <Card className="p-4 max-w-2xl">
          {!cats ? <Loading /> : cats.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-outline-variant/60">
              <Icon name={c.icon || 'category'} className="text-on-surface-variant" />
              <span className="flex-1 text-label-md">{c.name} <span className="text-on-surface-variant">· {c.product_count} products</span></span>
              <Toggle label="" checked={c.is_active} onChange={(v) => catAction(() => admin.updateCategory(c.id, { is_active: v }), v ? 'Category shown' : 'Category hidden')} />
              <button onClick={() => catAction(() => admin.deleteCategory(c.id), 'Category deleted (hidden if in use)')} aria-label={`Delete ${c.name}`} className="text-on-surface-variant hover:text-error"><Icon name="delete" /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <Input placeholder="New category" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
            <Input placeholder="Icon (e.g. devices)" value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} />
            <Button disabled={!newCat.name.trim()} onClick={() => catAction(async () => { await admin.createCategory({ name: newCat.name.trim(), icon: newCat.icon || null, sort_order: (cats || []).length }); setNewCat({ name: '', icon: '' }); }, 'Category added')}>Add</Button>
          </div>
        </Card>
      ) : (
        <>
          {tab === 'all' && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className={`${inputClass} max-w-xs mb-3`} aria-label="Search products" />}
          {!products ? <Loading /> : products.length === 0 ? <Empty icon="inventory_2" title="Nothing here" /> : tab === 'reports' ? (
            <div className="space-y-2">
              {products.map((r) => (
                <Card key={r.id} className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]"><p className="text-label-md font-semibold">{r.product_name}</p><p className="text-label-sm text-on-surface-variant">“{r.reason}” · {dateShort(r.created_at)}</p></div>
                  <Button size="sm" variant="danger" onClick={() => resolve(r, 'resolved', true)}>Remove product</Button>
                  <Button size="sm" variant="secondary" onClick={() => resolve(r, 'dismissed', false)}>Dismiss</Button>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {products.map((p) => (
                <Card key={p.id} className="p-3 flex gap-3">
                  <div className="w-14 h-14 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">{p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="inventory_2" className="text-on-surface-variant/40" />}</div>
                  <div className="min-w-0 flex-1 text-label-md">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-label-sm text-on-surface-variant">{p.seller_name} · {p.category} · {inr(p.price)}</p>
                    <div className="flex items-center gap-1 mt-1"><StatusBadge status={p.status} />{p.open_reports > 0 && <Badge tone="red">{p.open_reports} report(s)</Badge>}</div>
                    <div className="mt-1.5">{p.status === 'deleted' ? <Button size="sm" variant="secondary" onClick={() => moderate(p, 'published')}>Restore</Button> : <Button size="sm" variant="ghost" onClick={() => moderate(p, 'deleted')}>Remove</Button>}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Orders (§51) ──
export function AdminOrders({ onToast }) {
  const [group, setGroup] = useState('all');
  const [orders, reload] = useLoad(async () => (await listOrders(group)).items, [group]);
  const [inspect, setInspect] = useState(null);
  const [override, setOverride] = useState('');
  const open = async (id) => { setOverride(''); setInspect(await admin.inspectOrder(id)); };
  const apply = async () => {
    try { await setOrderStatus(inspect.id, override, { notes: 'Admin override' }); onToast('Order updated'); await open(inspect.id); reload(); } catch (err) { onToast(err.message, 'error'); }
  };
  return (
    <div>
      <PageHeader title="Orders" />
      <Tabs value={group} onChange={setGroup} tabs={[{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'delivered', label: 'Delivered & returns' }, { key: 'cancelled', label: 'Cancelled' }]} />
      {!orders ? <Loading /> : orders.length === 0 ? <Empty icon="receipt_long" title="No orders" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-label-md">
            <thead className="text-left text-on-surface-variant border-b border-outline-variant"><tr><th className="p-3">Order</th><th className="p-3">Buyer → Seller</th><th className="p-3 text-right">Total</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-outline-variant/60">
                  <td className="p-3"><span className="font-semibold">{o.order_number}</span><span className="block text-label-sm text-on-surface-variant">{dateTime(o.created_at)}</span></td>
                  <td className="p-3">{o.buyer_name} → {o.seller_name}</td>
                  <td className="p-3 text-right">{inr(o.total_amount)}</td>
                  <td className="p-3"><StatusBadge status={o.status} /></td>
                  <td className="p-3 text-right"><Button size="sm" variant="secondary" onClick={() => open(o.id)}>Inspect</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal open={!!inspect} onClose={() => setInspect(null)} title={`Order ${inspect?.order_number || ''}`} wide>
        {inspect && (
          <div className="space-y-4 text-label-md">
            <div className="grid sm:grid-cols-2 gap-3">
              <Card className="p-3"><p className="font-semibold">Buyer</p><p>{inspect.buyer.name}</p><p className="text-on-surface-variant">{inspect.buyer.email}{inspect.buyer.phone ? ` · ${inspect.buyer.phone}` : ''}</p><p className="text-on-surface-variant">{inspect.shipping_address}</p></Card>
              <Card className="p-3"><p className="font-semibold">Seller</p><p>{inspect.seller_name}</p><p className="text-on-surface-variant">Platform fee {inr(inspect.platform_fee || 0)}</p></Card>
              <Card className="p-3"><p className="font-semibold">Items</p>{inspect.items.map((i) => <p key={i.id}>{i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''} × {i.quantity} — {inr(i.total_price)}</p>)}<p className="font-semibold mt-1">Total {inr(inspect.total_amount)}</p></Card>
              <Card className="p-3"><p className="font-semibold">Payment</p>{inspect.payment ? <><p>{titleCase(inspect.payment.provider)} · <StatusBadge status={inspect.payment.status} /></p><p className="text-on-surface-variant">Ref {inspect.payment.reference} · settlement {titleCase(inspect.payment.settlement_status)}</p></> : '—'}
                {inspect.negotiation.length > 0 && <p className="text-on-surface-variant mt-1">Negotiated at {inr(inspect.negotiation[0].offered_price)}</p>}</Card>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Card className="p-3"><p className="font-semibold mb-1">Order tracking</p>{inspect.tracking.map((e) => <p key={e.id}>{titleCase(e.status)} · {e.actor_role || 'system'} · {dateTime(e.created_at)}</p>)}</Card>
              <Card className="p-3"><p className="font-semibold mb-1">Shipment {inspect.shipment?.shipment_number || ''}</p>{inspect.shipment_events.length === 0 ? <p className="text-on-surface-variant">Not shipped yet.</p> : inspect.shipment_events.map((e, i) => <p key={i}>{titleCase(e.status)}{e.location ? ` · ${e.location}` : ''} · {dateTime(e.created_at)}</p>)}</Card>
            </div>
            <Card className="p-3 max-h-56 overflow-y-auto"><p className="font-semibold mb-1">Buyer–seller messages</p>
              {inspect.communication.length === 0 ? <p className="text-on-surface-variant">No messages.</p> : inspect.communication.map((m, i) => <p key={i}><strong>{titleCase(m.sender)}:</strong> {m.content}{m.translated_content ? <span className="text-on-surface-variant"> ({m.translated_content})</span> : ''}</p>)}
            </Card>
            {inspect.disputes.length > 0 && <Card className="p-3"><p className="font-semibold mb-1">Disputes</p>{inspect.disputes.map((d) => <p key={d.id}>{titleCase(d.reason)} by {d.raised_by_role} · <StatusBadge status={d.status} />{d.resolution ? ` — ${d.resolution}` : ''}</p>)}</Card>}
            <div className="flex flex-wrap gap-2 items-end">
              <Field label="Override status (admin)">
                <Select value={override} onChange={(e) => setOverride(e.target.value)}>
                  <option value="">Choose…</option>{ALL_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select>
              </Field>
              <Button disabled={!override} onClick={apply}>Apply</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Shipments ──
export function AdminShipments({ onToast }) {
  const [view, setView] = useState('');
  const [rows, reload] = useLoad(() => listShipments(view ? { view } : {}), [view]);
  const [assigning, setAssigning] = useState(null);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState('');
  return (
    <div>
      <PageHeader title="Shipments" />
      <Tabs value={view} onChange={setView} tabs={[{ key: '', label: 'All' }, { key: 'pickups', label: 'Awaiting pickup' }, { key: 'deliveries', label: 'In progress' }, { key: 'completed', label: 'Completed' }]} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty icon="local_shipping" title="No shipments" /> : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Card key={s.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px] text-label-md"><p className="font-semibold">{s.shipment_number} · {s.order_number}</p><p className="text-on-surface-variant">{s.seller.name} → {s.buyer.name} · {s.partner?.company_name || 'unassigned'}{s.current_location ? ` · ${s.current_location}` : ''}</p></div>
              <StatusBadge status={s.status} />
              {['created', 'pickup_assigned'].includes(s.status) && <Button size="sm" variant="secondary" onClick={async () => { setAssigning(s); setPartnerId(''); setPartners(await listPartners()); }}>Assign partner</Button>}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!assigning} onClose={() => setAssigning(null)} title="Assign partner"
        footer={<Button disabled={!partnerId} onClick={async () => { try { await assignPartner(assigning.id, Number(partnerId)); onToast('Partner assigned'); setAssigning(null); reload(); } catch (err) { onToast(err.message, 'error'); } }}>Assign</Button>}>
        <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}><option value="">Choose…</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.company_name} ({p.service_city || '—'})</option>)}</Select>
      </Modal>
    </div>
  );
}

// ── Disputes (§51) ──
export function AdminDisputes({ onToast }) {
  const [status, setStatus] = useState('open');
  const [rows, reload] = useLoad(() => listDisputes(status || undefined), [status]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ status: 'resolved', resolution: '', refund: false });
  const save = async () => {
    try { await resolveDispute(editing.id, form); onToast('Dispute updated'); setEditing(null); reload(); } catch (err) { onToast(err.message, 'error'); }
  };
  return (
    <div>
      <PageHeader title="Disputes" />
      <Tabs value={status} onChange={setStatus} tabs={[{ key: 'open', label: 'Open' }, { key: 'under_review', label: 'Under review' }, { key: 'resolved', label: 'Resolved' }, { key: 'rejected', label: 'Rejected' }, { key: '', label: 'All' }]} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty icon="gavel" title="No disputes here" /> : (
        <div className="space-y-2">
          {rows.map((d) => (
            <Card key={d.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px] text-label-md">
                <p className="font-semibold">{titleCase(d.reason)} · order {d.order_number}</p>
                <p className="text-on-surface-variant">Raised by {d.raised_by_role} · {dateShort(d.created_at)}{d.description ? ` — “${d.description}”` : ''}</p>
                {d.resolution && <p className="text-on-surface-variant">Resolution: {d.resolution}</p>}
              </div>
              <StatusBadge status={d.status} />
              {['open', 'under_review'].includes(d.status) && <Button size="sm" onClick={() => { setEditing(d); setForm({ status: 'resolved', resolution: '', refund: false }); }}>Resolve</Button>}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Resolve dispute" footer={<Button onClick={save}>Save</Button>}>
        <div className="space-y-3">
          <Field label="Outcome"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="under_review">Mark under review</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></Select></Field>
          <Field label="Resolution (sent to buyer and seller)"><Textarea value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} /></Field>
          <Toggle label="Refund the buyer in full" checked={form.refund} onChange={(v) => setForm({ ...form, refund: v })} />
        </div>
      </Modal>
    </div>
  );
}

// ── Analytics ──
export function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [a] = useLoad(() => admin.analytics(days), [days]);
  if (!a) return <Loading />;
  const daily = a.daily.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }));
  const statusRows = Object.entries(a.orders_by_status).map(([k, v]) => ({ k: titleCase(k), v })).sort((x, y) => y.v - x.v);
  const bars = (dataKey, money) => (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f8" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6d7a77' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6d7a77' }} tickLine={false} axisLine={false} width={money ? 64 : 32} allowDecimals={false}
          tickFormatter={(v) => (money ? `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : v)} />
        <Tooltip formatter={(v) => (money ? inr(v) : v)} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey={dataKey} fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={36} name={money ? 'Revenue' : 'Orders'} />
      </BarChart>
    </ResponsiveContainer>
  );
  const hbar = (rows, label, value, money) => {
    const max = Math.max(...rows.map((r) => r[value]), 1);
    return rows.length === 0 ? <p className="text-label-md text-on-surface-variant">No data yet.</p> : (
      <ul className="space-y-2">{rows.map((r) => (
        <li key={r[label]} className="text-label-md"><div className="flex justify-between"><span>{r[label]}</span><span className="text-on-surface-variant">{money ? inr(r[value]) : r[value]}</span></div>
          <div className="h-2.5 mt-1 bg-surface-container rounded"><div className="h-full rounded" style={{ width: `${(r[value] / max) * 100}%`, background: MARK }} /></div></li>
      ))}</ul>
    );
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" actions={<Select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></Select>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon="repeat" label="Repeat purchase rate" value={`${Math.round(a.repeat_purchase_rate * 100)}%`} />
        <Stat icon="handshake" tone="purple" label="Offers accepted" value={`${Math.round(a.negotiation_acceptance_rate * 100)}%`} />
        <Stat icon="sentiment_satisfied" tone="green" label="Buyer satisfaction" value={a.buyer_satisfaction ? `${a.buyer_satisfaction}★` : '—'} />
        <Stat icon="timer" tone="blue" label="Pickup → delivery" value={a.avg_delivery_hours != null ? `${a.avg_delivery_hours} h` : '—'} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4"><h2 className="text-title-sm font-semibold mb-2">Revenue per day</h2>{daily.length ? bars('revenue', true) : <Empty title="No orders in this period" />}</Card>
        <Card className="p-4"><h2 className="text-title-sm font-semibold mb-2">Orders per day</h2>{daily.length ? bars('orders') : <Empty title="No orders in this period" />}</Card>
        <Card className="p-4"><h2 className="text-title-sm font-semibold mb-2">Orders by status</h2>{hbar(statusRows, 'k', 'v')}</Card>
        <Card className="p-4"><h2 className="text-title-sm font-semibold mb-2">Top categories</h2>{hbar(a.top_categories, 'category', 'revenue', true)}</Card>
        <Card className="p-4 lg:col-span-2"><h2 className="text-title-sm font-semibold mb-2">Top sellers</h2>{hbar(a.top_sellers, 'seller', 'revenue', true)}</Card>
      </div>
    </div>
  );
}

// ── Settings ──
export function AdminSettings({ onToast }) {
  const [s, setS] = useState(null);
  const [logs] = useLoad(() => admin.auditLogs(), []);
  useEffect(() => { admin.settings().then(setS).catch(() => {}); }, []);
  if (!s) return <Loading />;
  const num = (k, label, hint) => <Field key={k} label={label} hint={hint}><Input type="number" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>;
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <Card className="p-5 max-w-2xl space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          {num('platform_fee_pct', 'Platform fee (%)', 'Deducted from seller settlements.')}
          {num('standard_delivery_fee', 'Standard delivery fee (₹)')}
          {num('express_delivery_fee', 'Express delivery fee (₹)')}
          {num('free_delivery_threshold', 'Free delivery above (₹)')}
          {num('cod_max_amount', 'Cash on delivery limit (₹)')}
          {num('reorder_reminder_days', 'Reorder reminder after (days)')}
        </div>
        <Toggle label="Allow cash on delivery" checked={!!s.cod_enabled} onChange={(v) => setS({ ...s, cod_enabled: v })} />
        <div className="flex justify-end"><Button onClick={async () => { try { setS(await admin.saveSettings(s)); onToast('Settings saved'); } catch (err) { onToast(err.message, 'error'); } }}>Save settings</Button></div>
      </Card>
      <Card className="p-5 max-w-2xl flex flex-wrap items-center gap-3">
        <div className="flex-1"><p className="text-title-sm font-semibold">Seller settlements</p><p className="text-label-md text-on-surface-variant">Pay out every delivered order that's scheduled (simulated payout).</p></div>
        <Button icon="account_balance" onClick={async () => { try { const r = await admin.runSettlements(); onToast(`Settled ${r.settled_payments} payments to ${r.sellers_paid} sellers (${inr(r.total_paid_out)})`); } catch (err) { onToast(err.message, 'error'); } }}>Run settlements</Button>
      </Card>
      <Card className="p-5">
        <p className="text-title-sm font-semibold mb-2">Audit log</p>
        {!logs ? <Loading /> : logs.length === 0 ? <p className="text-label-md text-on-surface-variant">No admin actions yet.</p> : (
          <ul className="text-label-md divide-y divide-outline-variant/60 max-h-80 overflow-y-auto">
            {logs.map((l) => <li key={l.id} className="py-1.5"><strong>{l.action}</strong> · {l.resource_type}{l.resource_id ? ` #${l.resource_id}` : ''} · {dateTime(l.created_at)}{l.changes ? <span className="text-on-surface-variant"> — {l.changes}</span> : ''}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
