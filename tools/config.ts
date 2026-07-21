export const repository = {
  owner: process.env.FAUST_GITHUB_OWNER ?? 'lurui1997',
  name: process.env.FAUST_GITHUB_REPOSITORY ?? 'faust',
  branch: process.env.FAUST_GITHUB_BRANCH ?? 'main',
};

export const pages = {
  site: process.env.FAUST_SITE ?? `https://${repository.owner}.github.io`,
  base: process.env.FAUST_BASE ?? `/${repository.name}`,
};
