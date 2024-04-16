async function getContributors(repoName, page = 1) {
  const request = await fetch(`https://api.github.com/repos/${repoName}/contributors?per_page=100&page=${page}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const contributorsList = await request.json();
  return contributorsList;
}

async function getAllContributors(repoName, page = 1, allContributors = []) {
  const list = await getContributors(repoName, page);
  allContributors = allContributors.concat(list);
  if (list.length === 100) return getAllContributors(repoName, page + 1, allContributors);
  return allContributors;
}

async function getContributorsMultiple(repoNames) {
  const results = await Promise.all(repoNames.map((repoName) => getAllContributors(repoName)));
  const mergedMap = new Map();
  for (const contributors of results) {
    for (const { login, contributions, ...otherAttributes } of contributors) {
      if (!mergedMap.has(login)) mergedMap.set(login, { login, contributions, ...otherAttributes });
      else mergedMap.get(login).contributions += contributions;
    }
  }
  const mergedArray = Array.from(mergedMap.values());
  mergedArray.sort((a, b) => b.contributions - a.contributions);
  return mergedArray;
}

async function showContributors() {
  const contributors_btn = document.querySelector('#contributors');
  const contributors_view = document.querySelector('#contributors_tabitem');
  const temp = document.createElement('div');
  temp.id = 'contributors_grid';
  temp.innerHTML = '<p>Retrieving contributor list<br>We are grateful for the many individuals who have generously put their time and effort to make this possible</p>';
  temp.style.display = 'flex';
  temp.style.flexDirection = 'column';
  temp.style.justifyContent = 'center';
  temp.style.alignItems = 'center';
  temp.style.height = '100%';
  temp.style.whiteSpace = 'normal';
  contributors_view.append(temp);
  contributors_btn.addEventListener('click', async (evt) => {
    if (!contributors_btn.getAttribute('data-visited')) {
      contributors_btn.setAttribute('data-visited', 'true');
      const promise = getContributorsMultiple(['vladmandic/automatic', 'BinaryQuantumSoul/sdnext-ui-ux']);
      promise.then((result) => {
        temp.innerHTML = '';
        temp.style = '';
        for (let i = 0; i < result.length; i++) {
          const login = result[i].login;
          const html_url = result[i].html_url;
          const avatar_url = result[i].avatar_url;
          temp.innerHTML += `
            <a href="${html_url}" target="_blank" rel="noopener noreferrer nofollow" class="contributor-button flexbox col">
              <figure><img src="${avatar_url}" lazy="true"></figure>
              <div class="contributor-name">${login}</div>
            </a>`;
        }
      });
    }
  });
}
