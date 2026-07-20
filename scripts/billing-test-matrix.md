# Subscription billing — manual test matrix

Run after deploying billing changes. Requires Razorpay test keys unless `BILLING_SKIP_PAYMENT=true`.

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | New registration | Register restaurant | `TRIAL` on Starter, trial features in sidebar |
| 2 | Trial expires, no payment | Set `trialEndsAt` in past, run `npx tsx scripts/run-cron.ts subscriptions` | Restaurant `SUSPENDED`, gate overlay |
| 3 | Owner buys Starter | Billing → Subscribe → pay Razorpay | `ACTIVE`, invoice synced, single line item |
| 4 | Upgrade Starter→Pro (immediate) | Upgrade → pay | Status **Upgrade Pending Payment** until pay; then one invoice at full Pro price; new cycle from pay date; old RZ sub cancelled |
| 5 | Super admin immediate change | Platform restaurant → Change Plan → Immediately → Generate Payment | Same as #4; owner notified |
| 6 | Schedule at renewal | Change Plan → From Next Renewal | Stays on current plan until `currentPeriodEnd`; `scheduledPlan` set |
| 7 | Grace after expiry | `ACTIVE` + past `currentPeriodEnd`, run subscriptions cron | `EXPIRED`, grace banner, features still work |
| 8 | Grace ends | Past `gracePeriodEndsAt`, run cron | `SUSPENDED`, overlay, staff blocked |
| 9 | Admin extend 7 days | Platform → Add Free Days | Period extended, `ACTIVE` if was expired |
| 10 | Renewal verify fallback | Renew via order; complete Razorpay; webhook disabled | `verifyRenewalPayment` activates locally |
| 11 | Billing sync cron | `npx tsx scripts/run-cron.ts billing-sync` | Stuck `pendingCheckout` reconciled; invoices synced |

## Quick cron (KVM2)

```bash
CRON_SECRET=your_secret APP_URL=http://127.0.0.1:3000 npx tsx scripts/run-cron.ts all
```
