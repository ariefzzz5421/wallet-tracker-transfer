export const creators = [
  {
    id: 'guaremperor',
    name: 'GuarEmperor',
    handle: '@GuarEmperor',
    profileUrl: 'https://x.com/GuarEmperor',
    avatar: '/creators/guaremperor.svg',
    bio: 'Public wallet trackers, NFT wallet scraping, and multichain degen lists.',
    packs: [
      {
        id: 'notion-01',
        title: 'Project Mars Land — Top 60 Wallets',
        preview: 'Top 60 tracked wallets from Project Mars Land.',
        tags: ['NFT', 'Robinhood', 'Project Mars Land'],
        titleStatus: 'verified-page-title',
        pageId: '52c36ac9a1074b8897f7e413caa0597d',
        viewId: '23118e91dbb54d6f890090ac21fe5c42',
        url: 'https://uttermost-pumpkin-971.notion.site/52c36ac9a1074b8897f7e413caa0597d?v=23118e91dbb54d6f890090ac21fe5c42',
      },
      {
        id: 'notion-02',
        title: 'Scrape Wallet NFTs (Hype · Pons · Inks)',
        preview: 'Scraped wallets from Inks, Hype Brokers, Hype Terminal, Ponsguys and other high-ROI NFT plays.',
        tags: ['NFT', 'Multichain', 'Hype', 'Pons'],
        titleStatus: 'verified-page-title',
        pageId: '9a9f8e3b939c4005a90b86e065838b2b',
        viewId: '3cf2390761ca81fb9e99000c2db58f17',
        url: 'https://uttermost-pumpkin-971.notion.site/9a9f8e3b939c4005a90b86e065838b2b?v=3cf2390761ca81fb9e99000c2db58f17&pvs=74',
      },
      {
        id: 'notion-03',
        title: 'GE Smart Money Wallets',
        preview: 'GuarEmperor public NFT wallet tracker database.',
        tags: ['NFT', 'Tracker', 'Degen'],
        titleStatus: 'verified-page-title',
        pageId: 'b8ca8c3741d74d709e6c8e17c254818d',
        viewId: '3c02390761ca816cb594000c92f2f6ce',
        url: 'https://uttermost-pumpkin-971.notion.site/b8ca8c3741d74d709e6c8e17c254818d?v=3c02390761ca816cb594000c92f2f6ce&pvs=74',
      },
      {
        id: 'notion-04',
        title: 'Wallet Labels — Stable 2026-07-23',
        preview: 'Public wallet list shared for stable/meme tracking.',
        tags: ['Meme', 'Stable', 'Wallets'],
        titleStatus: 'verified-page-title',
        pageId: '80f2d75809244415bae1ff4b48d78cf1',
        viewId: '5fa6abd7ba704cd6b67714325200408a',
        url: 'https://uttermost-pumpkin-971.notion.site/80f2d75809244415bae1ff4b48d78cf1?v=5fa6abd7ba704cd6b67714325200408a',
      },
      {
        id: 'notion-05',
        title: 'Arc Smart Money Wallets',
        preview: 'Arc meme / smart-money wallets shared for mainnet tracking and research.',
        tags: ['Arc', 'Smart Money', 'Meme'],
        titleStatus: 'verified-page-title',
        pageId: 'd0afecae9b1445fc8f73f1b44b43b75c',
        viewId: 'cd6f8615c95f4d9881688c70c0d23053',
        url: 'https://uttermost-pumpkin-971.notion.site/d0afecae9b1445fc8f73f1b44b43b75c?v=cd6f8615c95f4d9881688c70c0d23053',
      },
    ],
  },
];

export const starterPacks = creators.flatMap(creator =>
  creator.packs.map(pack => ({ ...pack, creatorId: creator.id, creatorName: creator.name }))
);
