/**
 * Plan catalogue shown on /pricing. Keep in sync with the gateway's quota
 * configuration (services/api-gateway) and the Stripe price IDs.
 * Prices mirror the gateway's SUBSCRIPTION_PLANS — confirm before launch.
 */
export interface Plan {
  id: 'free' | 'pro' | 'team';
  name: string;
  tagline: string;
  monthly: number;
  /** Effective monthly price when billed yearly. */
  yearly: number;
  cta: string;
  highlighted?: boolean;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'free', name: 'Free', tagline: 'For occasional tasks', monthly: 0, yearly: 0, cta: 'Start for free',
    features: ['All in-browser tools, unlimited', '3 cloud tasks per day (OCR, convert, compress)', 'Files up to 100 MB', 'Up to 200 pages per document', 'Files deleted within 2 hours'],
  },
  {
    id: 'pro', name: 'Pro', tagline: 'For professionals', monthly: 12, yearly: 7.5, cta: 'Upgrade to Pro', highlighted: true,
    features: ['Everything in Free', 'Unlimited cloud tasks', 'Files up to 1 GB, unlimited pages', 'Batch processing', 'Priority OCR queue', 'Desktop app licence', 'Email support'],
  },
  {
    id: 'team', name: 'Business', tagline: 'For teams & firms', monthly: 49, yearly: 39, cta: 'Start Business',
    // Seats, SSO and the API are not built yet — keep them labelled 'coming soon' until they ship.
    features: ['Everything in Pro', 'Document workspace (DMS)', 'Invoice scanner with DATEV / ZUGFeRD export', 'Data processing agreement (DPA)', 'Team seats & SSO (coming soon)', 'API access (coming soon)'],
  },
];
