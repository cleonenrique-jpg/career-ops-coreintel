import { talentCom } from './portals/talent-com.js';
import { computrabajo } from './portals/computrabajo.js';
import { procomer } from './portals/procomer.js';
import { cinde } from './portals/cinde.js';
import { linkedin } from './portals/linkedin.js';
import type { PortalConfig } from './types.js';

export const ALL_PORTALS: PortalConfig[] = [talentCom, computrabajo, procomer, cinde, linkedin];

export * from './types.js';
export * from './filters.js';
export * from './scrape.js';
export { talentCom, computrabajo, procomer, cinde, linkedin };
