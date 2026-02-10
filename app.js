const width = 900;
const height = 520;

const colorByType = {
  root: '#0284c7',
  category: '#2563eb',
  word: '#7c3aed',
  unknown: '#64748b'
};

const detailEl = document.querySelector('#detail');
const inputEl = document.querySelector('#wordInput');
const searchBtn = document.querySelector('#searchBtn');

let nodesMap = {};
let nodeGroups = null;
let activeWord = null;

const svg = d3
  .select('#treemap')
  .append('svg')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .attr('width', '100%')
  .attr('height', height);

function escapeHTML(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pathFor(word) {
  const path = [];
  let cur = nodesMap[word];
  while (cur) {
    path.push(cur.name);
    cur = cur.parent ? nodesMap[cur.parent] : null;
  }
  return path.reverse();
}

function buildHierarchy(nodes) {
  nodesMap = {};
  Object.entries(nodes).forEach(([name, node]) => {
    nodesMap[name] = { name, ...node };
  });

  const rootName = Object.entries(nodesMap).find(([, n]) => !n.parent)?.[0];
  if (!rootName) {
    throw new Error('Root node not found in knowledge_base.json');
  }

  const makeTree = (name) => {
    const current = nodesMap[name];
    return {
      name,
      type: current.type || 'unknown',
      description: current.description || '',
      related: current.related || [],
      parent: current.parent || null,
      children: (current.children || []).map(makeTree)
    };
  };

  return makeTree(rootName);
}

function drawTreemap(treeData) {
  svg.selectAll('*').remove();

  const root = d3
    .hierarchy(treeData)
    .sum((d) => (d.children?.length ? 0 : 1))
    .sort((a, b) => b.value - a.value);

  d3.treemap().size([width, height]).padding(2)(root);

  nodeGroups = svg
    .selectAll('g')
    .data(root.descendants())
    .join('g')
    .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

  nodeGroups
    .append('rect')
    .attr('class', 'node-rect')
    .attr('data-name', (d) => d.data.name)
    .attr('fill', (d) => colorByType[d.data.type] || colorByType.unknown)
    .attr('width', (d) => Math.max(0, d.x1 - d.x0))
    .attr('height', (d) => Math.max(0, d.y1 - d.y0))
    .on('click', (_, d) => selectWord(d.data.name));

  nodeGroups
    .append('text')
    .attr('class', 'node-label')
    .attr('x', 4)
    .attr('y', 14)
    .text((d) => {
      const w = d.x1 - d.x0;
      if (w < 56) return '';
      return d.data.name;
    });
}

async function fetchDictionaryContext(word) {
  const contexts = [];

  const wikiTargets = [
    `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`,
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`
  ];

  for (const target of wikiTargets) {
    try {
      const resp = await fetch(target, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.extract) {
        contexts.push({
          source: target.includes('zh.wikipedia') ? '中文维基百科' : 'English Wikipedia',
          text: data.extract
        });
        break;
      }
    } catch {
      // ignore network failures
    }
  }

  try {
    const dictResp = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (dictResp.ok) {
      const dictData = await dictResp.json();
      const first = dictData?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
      if (first) {
        contexts.push({ source: 'DictionaryAPI (EN)', text: first });
      }
    }
  } catch {
    // ignore network failures
  }

  return contexts;
}

function setActiveRect(word) {
  activeWord = word;
  d3.selectAll('.node-rect').classed('active', (d) => d.data.name === word);
}

async function renderDetail(word) {
  const node = nodesMap[word];
  if (!node) {
    detailEl.innerHTML = `<p>❌ '${escapeHTML(word)}' 는 현재 내부 지식 그래프에 없습니다.</p>`;
    return;
  }

  const chain = pathFor(word).join(' > ');
  const children = node.children?.length ? node.children.join(', ') : '없음';
  const related = node.related?.length ? node.related.join(', ') : '없음';

  detailEl.innerHTML = `
    <p><span class="badge">${escapeHTML(node.type || 'unknown')}</span></p>
    <p><strong>단어:</strong> ${escapeHTML(word)}</p>
    <p><strong>설명:</strong> ${escapeHTML(node.description || '설명 없음')}</p>
    <p><strong>체계 경로:</strong> ${escapeHTML(chain)}</p>
    <p><strong>하위 개념:</strong> ${escapeHTML(children)}</p>
    <p><strong>연관 단어:</strong> ${escapeHTML(related)}</p>
    <p><em>외부 사전/백과 데이터를 불러오는 중...</em></p>
  `;

  const contexts = await fetchDictionaryContext(word);
  const contextsHtml = contexts.length
    ? `<h3>외부 데이터 연동</h3><ul>${contexts
        .map((c) => `<li><strong>${escapeHTML(c.source)}:</strong> ${escapeHTML(c.text)}</li>`)
        .join('')}</ul>`
    : '<p>외부 백과/사전에서 추가 데이터를 찾지 못했습니다.</p>';

  detailEl.innerHTML = `
    <p><span class="badge">${escapeHTML(node.type || 'unknown')}</span></p>
    <p><strong>단어:</strong> ${escapeHTML(word)}</p>
    <p><strong>설명:</strong> ${escapeHTML(node.description || '설명 없음')}</p>
    <p><strong>체계 경로:</strong> ${escapeHTML(chain)}</p>
    <p><strong>하위 개념:</strong> ${escapeHTML(children)}</p>
    <p><strong>연관 단어:</strong> ${escapeHTML(related)}</p>
    ${contextsHtml}
  `;
}

function selectWord(word) {
  if (!nodesMap[word]) {
    detailEl.innerHTML = `<p>❌ '${escapeHTML(word)}' 는 지식 그래프에 없습니다.</p>`;
    return;
  }
  setActiveRect(word);
  renderDetail(word);
}

searchBtn.addEventListener('click', () => {
  const keyword = inputEl.value.trim();
  if (!keyword) return;

  if (nodesMap[keyword]) {
    selectWord(keyword);
  } else {
    detailEl.innerHTML = `
      <p>❌ 내부 그래프에서 '${escapeHTML(keyword)}' 를 찾지 못했습니다.</p>
      <p>원하시면 knowledge_base.json에 이 단어를 추가해 트리맵에 편입할 수 있습니다.</p>
    `;
  }
});

inputEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') searchBtn.click();
});

async function init() {
  const resp = await fetch('./knowledge_base.json');
  const data = await resp.json();
  const treeData = buildHierarchy(data.nodes);
  drawTreemap(treeData);

  const defaultWord = '妈妈';
  inputEl.value = defaultWord;
  selectWord(defaultWord);
}

init().catch((error) => {
  detailEl.innerHTML = `<p>앱 초기화 실패: ${escapeHTML(error.message)}</p>`;
});
