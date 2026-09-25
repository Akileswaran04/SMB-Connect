/**
 * One AI pick (PRD §9–10): tag, price, product, seller, and "Why this?" —
 * a few plain reasons, with "See more" for the rest.
 */
import { useState } from 'react';
import { Icon, Badge } from '../../../components/ui';
import { inr, deliveryText } from '../../../utils/format';

const TAGS = {
  'Best Fit': { tone: 'primary', icon: 'verified' },
  'Better Value': { tone: 'green', icon: 'savings' },
  'Faster Delivery': { tone: 'amber', icon: 'bolt' },
  'Premium Option': { tone: 'purple', icon: 'workspace_premium' },
};

export default function RecommendationCard({ item, onView, onCompareToggle, compared }) {
  const [more, setMore] = useState(false);
  const tag = TAGS[item.tag] || TAGS['Best Fit'];
  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden flex flex-col">
      <div className="h-36 bg-surface-container flex items-center justify-center relative">
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
          : <Icon name="inventory_2" size={40} className="text-on-surface-variant/40" />}
        <Badge tone={tag.tone} className="absolute top-3 left-3 shadow-sm"><Icon name={tag.icon} size={14} />{item.tag}</Badge>
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-headline-sm text-on-surface font-bold">{inr(item.price)}</p>
          {item.listed_price && item.listed_price > item.price && (
            <p className="text-label-md text-on-surface-variant line-through">{inr(item.listed_price)}</p>
          )}
        </div>
        <p className="text-title-sm text-on-surface font-semibold">{item.name}</p>
        <p className="text-label-sm text-on-surface-variant">
          {item.seller_name}
          {item.rating ? ` · ${item.rating}★` : ''}
          {item.delivery_days ? ` · ${deliveryText(item.delivery_days)}` : ''}
        </p>

        <div className="mt-2">
          <p className="text-label-sm font-semibold text-on-surface">Why this?</p>
          <ul className="mt-1 space-y-1">
            {(more ? [...item.reasons, ...(item.more_reasons || [])] : item.reasons).map((r) => (
              <li key={r} className="flex items-start gap-1.5 text-label-sm text-on-surface-variant">
                <Icon name="check_circle" size={14} className="text-emerald-600 mt-0.5" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {item.more_reasons?.length > 0 && (
            <button onClick={() => setMore((m) => !m)} className="text-label-sm text-primary font-medium mt-1">
              {more ? 'See less' : 'See more'}
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-auto pt-3">
          <button onClick={() => onView(item)} className="flex-1 h-10 rounded-lg bg-primary text-on-primary text-label-md font-semibold">View</button>
          {onCompareToggle && (
            <button onClick={() => onCompareToggle(item)} aria-pressed={compared}
              className={`h-10 px-3 rounded-lg border text-label-md ${compared ? 'border-primary text-primary bg-primary-container/10' : 'border-outline-variant text-on-surface-variant'}`}
              title="Add to comparison">
              <Icon name={compared ? 'check' : 'compare_arrows'} size={18} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
