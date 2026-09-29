import {
  createCampaign,
  validateCampaignSave,
  type CampaignState,
} from '@arcanora/core';

export const CAMPAIGN_SAVE_KEY = 'arcanora_campaign_v1';

export type CampaignLoad = {
  state: CampaignState | null;
  error: string | null;
};

export function loadCampaign(): CampaignLoad {
  try {
    const raw = localStorage.getItem(CAMPAIGN_SAVE_KEY);
    if (raw === null) return { state: null, error: null };
    return { state: validateCampaignSave(JSON.parse(raw)), error: null };
  } catch {
    return {
      state: null,
      error: 'Your campaign could not be opened. It has been kept on this device. You can begin a new campaign, or return later after restoring your save.',
    };
  }
}

export function saveCampaign(state: CampaignState): string | null {
  try {
    const checked = validateCampaignSave(state);
    localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(checked));
    return null;
  } catch {
    return 'Your progress is active, but this device could not save it. Free some browser storage, then make another choice to try again.';
  }
}

export function freshCampaign(name: string): CampaignState {
  const seed = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
    ? crypto.getRandomValues(new Uint32Array(1))[0]
    : Math.floor(Math.random() * 0xffffffff);
  return createCampaign(seed || 1, name.trim() || undefined);
}
