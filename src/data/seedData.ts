import { BenefitAsset, LedgerEntry, ReminderSettings } from '../types/benefits';

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISO(): string {
  return formatISODate(new Date());
}

export function shiftDateISO(baseISO: string, offsetDays: number): string {
  const [y, m, d] = baseISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  return formatISODate(dt);
}

export function createEmptyState(): {
  assets: BenefitAsset[];
  ledger: LedgerEntry[];
  settings: ReminderSettings;
} {
  return {
    assets: [],
    ledger: [],
    settings: {
      warningWindowDays: 30,
      urgentWindowDays: 7,
    },
  };
}
