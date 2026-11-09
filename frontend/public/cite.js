const params = new URLSearchParams(location.search);
const title = document.querySelector('h1');
const status = document.querySelector('#status');
const entries = document.querySelector('#entries');
try {
  const response = await fetch('./data/handbooks/catalog.json');
  const catalog = await response.json();
  const source = catalog.find(item => item.id === params.get('doc'));
  if (!source) throw new Error('没有找到此资料。');
  title.textContent = source.name;
  const page = Number(params.get('page'));
  if (!page) {
    status.textContent = source.pagesWithText
      ? '共有 ' + source.pageCount + ' 页，其中 ' + source.pagesWithText + ' 页有文字索引。请从知识库的检索结果进入对应页。'
      : '这册资料是扫描件，等待 OCR 建立文字索引。';
  } else {
    const data = await fetch('./data/handbooks/' + source.id + '.json');
    if (!data.ok) throw new Error('这册资料的文字索引暂不可用。');
    const result = (await data.json()).filter(item => item.page === page);
    status.textContent = 'PDF 第 ' + page + ' 页 · 入库文字片段';
    for (const item of result) {
      const article = document.createElement('article');
      article.textContent = item.text;
      entries.append(article);
    }
    if (!result.length) status.textContent += ' · 该页未检索到文字。';
  }
} catch (error) {
  status.textContent = error.message;
}
