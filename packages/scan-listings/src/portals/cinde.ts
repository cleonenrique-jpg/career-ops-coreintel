import type { PortalConfig, RawCandidate } from '../types.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

const QUERY = `query ($search: String!, $page: Int!, $limit: Int!, $companies: [String!], $package: String!, $modalities: [String!], $categories: [String!], $workExperiences: [String!], $englishLevels: [String!], $portugueseLevels: [String!], $frenchLevels: [String!], $forme: String, $fairId: Int) {
  viewJobOffers(search: $search, page: $page, limit: $limit, companies: $companies, package: $package, modalities: $modalities, categories: $categories, workExperiences: $workExperiences, englishLevels: $englishLevels, portugueseLevels: $portugueseLevels, frenchLevels: $frenchLevels, forme: $forme, fairId: $fairId) {
    name nameEs companyName companySlug officeName slug languages
  }
}`;

export const cinde: PortalConfig = {
  name: 'CINDE Jobs',
  source: 'cinde' as any, // not in shared enum yet — handled at insertion time
  fetcher: async (ctx) => {
    const variables = {
      search: '', page: 1, limit: 300, companies: [], package: '',
      modalities: [], categories: [], workExperiences: [],
      englishLevels: [], portugueseLevels: [], frenchLevels: [],
      forme: '', fairId: 100,
    };
    const resp = await ctx.request.post('https://api.cindejobs.com/graphql', {
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer null',
        origin: 'https://cindejobs.com',
        'user-agent': USER_AGENT,
      },
      data: { query: QUERY, variables },
    });
    if (resp.status() !== 200) {
      console.log(`  ✗ CINDE GraphQL returned HTTP ${resp.status()}`);
      return [];
    }
    const json: any = await resp.json().catch(() => ({}));
    const offers: any[] = json?.data?.viewJobOffers || [];
    console.log(`  ↻ CINDE: ${offers.length} offers fetched`);
    const out: RawCandidate[] = offers.map((o) => ({
      title: (o.nameEs || o.name || '').trim(),
      url: `https://cindejobs.com/es/feria/${o.companySlug}/${o.slug}`,
      company: (o.companyName || '').trim(),
      location: (o.officeName || '').trim(),
    }));
    return out.filter((o) => o.title && o.url.includes('/feria/'));
  },
};
