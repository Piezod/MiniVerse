export interface AccessPolicy {
  readonly freeWeapons: boolean;
  readonly freeLevels: boolean;
}

export const STANDARD_ACCESS: AccessPolicy = {
  freeWeapons: false,
  freeLevels: false,
};

export const PLATFORMER_ACCESS: AccessPolicy = {
  freeWeapons: true,
  freeLevels: true,
};