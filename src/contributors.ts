/* Fetch and render GitHub contributors for ModernUI support info. */
interface Contributor {
  login: string;
  contributions: number;
  html_url: string;
  avatar_url: string;
  [key: string]: unknown;
}

async function getContributors(repoName: string, page = 1): Promise<Contributor[]> {
  const request = await fetch(`https://api.github.com/repos/${repoName}/contributors?per_page=100&page=${page}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return request.json() as Promise<Contributor[]>;
}

async function getAllContributors(repoName: string, page = 1, allContributors: Contributor[] = []): Promise<Contributor[]> {
  const list = await getContributors(repoName, page);
  const merged = allContributors.concat(list);
  if (list.length === 100) return getAllContributors(repoName, page + 1, merged);
  return merged;
}

async function getContributorsMultiple(repoNames: string[]): Promise<Contributor[]> {
  const results = await Promise.all(repoNames.map((repoName) => getAllContributors(repoName)));
  const mergedMap = new Map<string, Contributor>();
  for (const contributors of results) {
    for (const contributor of contributors) {
      const { login, contributions } = contributor;
      if (!mergedMap.has(login)) mergedMap.set(login, { ...contributor });
      else mergedMap.get(login)!.contributions += contributions;
    }
  }
  const mergedArray = Array.from(mergedMap.values());
  mergedArray.sort((a, b) => b.contributions - a.contributions);
  return mergedArray;
}

export async function showContributors(): Promise<void> {
  const contributorsBtn = document.querySelector('#contributors');
  const contributorsView = document.querySelector('#contributors_tabitem');
  if (!contributorsView) return;
  const temp = document.createElement('div');
  temp.id = 'contributors_grid';
  temp.innerHTML = '<p>Retrieving contributor list<br>We are grateful for the many individuals who have generously put their time and effort to make this possible</p>';
  temp.style.display = 'flex';
  temp.style.flexDirection = 'column';
  temp.style.justifyContent = 'center';
  temp.style.alignItems = 'center';
  temp.style.height = '100%';
  temp.style.whiteSpace = 'normal';
  contributorsView.append(temp);
  contributorsBtn?.addEventListener('click', async () => {
    if (!contributorsBtn.getAttribute('data-visited')) {
      contributorsBtn.setAttribute('data-visited', 'true');
      const promise = getContributorsMultiple(['vladmandic/sdnext', 'BinaryQuantumSoul/sdnext-ui-ux']);
      promise.then((result) => {
        temp.innerHTML = '';
        temp.style.cssText = '';
        for (let i = 0; i < result.length; i++) {
          const login = result[i].login;
          const htmlUrl = result[i].html_url;
          const avatarUrl = result[i].avatar_url;
          temp.innerHTML += `
            <a href="${htmlUrl}" target="_blank" rel="noopener noreferrer nofollow" class="contributor-button flexbox col">
              <figure><img src="${avatarUrl}" lazy="true"></figure>
              <div class="contributor-name">${login}</div>
            </a>`;
        }
      });
    }
  });
}
