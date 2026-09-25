/**
 * Wikipedia Tagger - Web Worker
 * Internal Wikipedia Dump Engine (Browser-Native Client-Side)
 * Handles streaming gzip decompression, dictionary indexing, and greedy longest matching.
 */

// Japanese basic vocabulary / stop words (Wiktionary Basic 1000 + grammatical items)
const BASIC_STOP_WORDS = new Set([
  'これ', 'それ', 'あれ', 'どれ', 'ここ', 'そこ', 'あそこ', 'どこ', 'こちら', 'そちら', 'あちら', 'どちら',
  '私', 'わたくし', '僕', '俺', 'あなた', '彼', '彼女', '自分', '誰', '何',
  'もの', 'こと', 'とき', 'ため', 'よう', 'そう', 'どう', 'ところ', 'わけ', 'はず', 'つもり',
  'とおり', 'まま', 'ほう', 'なか', 'うえ', 'した', 'まえ', 'あと', 'ほか', 'あいだ',
  'ある', 'いる', 'する', 'なる', 'れる', 'られる', 'せる', 'させる',
  'いく', 'くる', 'みる', 'いう', 'おもう', 'きく', 'はなす', 'わかる', 'できる', 'しる',
  'もつ', 'おく', 'だす', 'はいる', 'でる', 'あがる', 'さがる', 'つく', 'つくる',
  '行う', 'おこなう', '進める', 'もたらす', '記述する', '利用する', '研究する', '期待される',
  'また', 'および', 'しかし', 'そして', 'さらに', 'ただし', 'なお', 'あるいは', 'または',
  'とても', 'たいへん', 'いつも', 'すでに', 'もっと', 'ほぼ', 'かなり', 'まったく',
  'から', 'まで', 'より', 'だけ', 'ほど', 'ばかり', 'くらい', 'など', 'でも', 'とか',
  'といった', 'における', 'について', 'として', 'によって', 'により', 'に対して', 'に関して', 'という',
  'である', '特有', '一般的', '現在', '今日', '近年', '基礎', '重要', '可能', '先端', '次世代',
  '一つ', '二つ', '三つ', '一人', '二人', '一日', '一年', '一月', '一度', '一回',
  '日', '年', '月', '時', '分', '秒', '回', '度', '人', '個', '本', '枚', '台'
]);

const HIRAGANA_REGEX = /^[\u3040-\u309F]+$/;

let titles = new Set();
let maxTitleLen = 35;
let isLoaded = false;

// HTML Entity & Injection Character escape
// Escapes: ' " \ \n \r \t & < >
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&(?!(?:amp|lt|gt|quot|#39;|#039;|#92;|#10;|#13;|#9;|#\d+;|[a-zA-Z]+;))/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\\/g, '&#92;')
    .replace(/\r/g, '&#13;')
    .replace(/\t/g, '&#9;');
}

/**
 * Load dictionary data with streaming gzip decompression and Cache API support
 */
async function loadDictionary(dataPath = '../data/wikipedia_titles.txt.gz') {
  const startTime = performance.now();
  postMessage({ type: 'status', phase: 'fetching', message: 'Wikipediaダンプデータを取得中...' });

  try {
    const cacheName = 'wiki-tagger-data-cache-v1';
    let response = null;

    // Try Cache API if available
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(cacheName);
        response = await cache.match(dataPath);
        if (response) {
          postMessage({ type: 'status', phase: 'cached', message: 'ブラウザキャッシュから読み込み中...' });
        } else {
          // Fetch from network and store in cache
          const netResponse = await fetch(dataPath);
          if (!netResponse.ok) {
            throw new Error(`HTTP Error: ${netResponse.status} ${netResponse.statusText}`);
          }
          await cache.put(dataPath, netResponse.clone());
          response = netResponse;
        }
      } catch (cacheErr) {
        console.warn('Cache API warning:', cacheErr);
      }
    }

    // Normal fetch fallback
    if (!response) {
      response = await fetch(dataPath);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
    }

    const contentLength = response.headers.get('Content-Length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 12357166; // fallback expected size

    let receivedBytes = 0;
    const trackingStream = new TransformStream({
      transform(chunk, controller) {
        receivedBytes += chunk.byteLength;
        const progress = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
        postMessage({
          type: 'progress',
          phase: 'downloading',
          progress,
          receivedBytes,
          totalBytes,
          message: `データ取得中... (${Math.round(receivedBytes / 1024 / 1024 * 10) / 10} MB / ${Math.round(totalBytes / 1024 / 1024 * 10) / 10} MB)`
        });
        controller.enqueue(chunk);
      }
    });

    postMessage({ type: 'status', phase: 'decompressing', message: '辞書データを解凍・展開中...' });

    // Stream decompression via DecompressionStream
    let decompressedStream;
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      decompressedStream = response.body.pipeThrough(trackingStream).pipeThrough(ds);
    } else {
      throw new Error('お使いのブラウザは DecompressionStream (GZIPストリーミング解凍) に未対応です。');
    }

    const reader = decompressedStream.getReader();
    const decoder = new TextDecoder('utf-8');
    let remainder = '';
    let lineCount = 0;
    let lastProgressTime = performance.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = remainder + decoder.decode(value, { stream: true });
      const lines = chunkText.split('\n');
      remainder = lines.pop() || '';

      const len = lines.length;
      for (let i = 0; i < len; i++) {
        const line = lines[i].trim();
        if (line) {
          titles.add(line);
          lineCount++;
          if (line.length > maxTitleLen) {
            maxTitleLen = Math.min(40, line.length);
          }
        }
      }

      const now = performance.now();
      if (now - lastProgressTime > 150) {
        postMessage({
          type: 'progress',
          phase: 'indexing',
          count: lineCount,
          message: `語彙インデックス構築中... (${(lineCount / 10000).toFixed(1)}万語)`
        });
        lastProgressTime = now;
      }
    }

    // Process leftover line
    if (remainder.trim()) {
      titles.add(remainder.trim());
      lineCount++;
    }

    isLoaded = true;
    const elapsed = performance.now() - startTime;
    console.log(`[Worker] Loaded ${titles.size} titles in ${elapsed.toFixed(1)}ms`);

    postMessage({
      type: 'ready',
      titlesCount: titles.size,
      maxTitleLen,
      elapsedMs: elapsed,
      message: `準備完了 (${titles.size.toLocaleString()} 語搭載)`
    });

  } catch (err) {
    console.error('[Worker] Load error:', err);
    postMessage({
      type: 'error',
      phase: 'load',
      message: `辞書データの読み込みに失敗しました: ${err.message}`
    });
  }
}

/**
 * Greedy Longest Match Tagging
 */
function tagText(text, options = {}) {
  const filterStopwords = options.filter_stopwords !== false;
  const filterHiragana = options.filter_hiragana !== false;
  const minWordLen = parseInt(options.min_word_len || 2, 10);
  const customExcludes = new Set(options.custom_excludes || []);

  // Enforce max 2,000 characters limit for large-scale data registration prevention
  const MAX_INPUT_LENGTH = 2000;
  let sanitizedText = String(text || '');
  if (sanitizedText.length > MAX_INPUT_LENGTH) {
    sanitizedText = sanitizedText.slice(0, MAX_INPUT_LENGTH);
  }

  const startTime = performance.now();
  const n = sanitizedText.length;
  let i = 0;

  const plainParts = [];
  const htmlParts = [];
  const termCounter = new Map();
  const termFirstPos = new Map();

  const maxSearch = Math.min(maxTitleLen, 35);

  while (i < n) {
    let matched = null;
    const currentMax = Math.min(maxSearch, n - i);

    for (let l = currentMax; l >= minWordLen; l--) {
      const cand = sanitizedText.slice(i, i + l);

      if (titles.has(cand)) {
        if (customExcludes.has(cand)) continue;
        if (filterStopwords && BASIC_STOP_WORDS.has(cand)) continue;
        if (filterHiragana && cand.length <= 3 && HIRAGANA_REGEX.test(cand)) continue;

        matched = cand;
        break;
      }
    }

    if (matched) {
      plainParts.push(`[${matched}]`);

      const safeTitle = escapeHtml(matched);
      const wikiUrl = `https://ja.wikipedia.org/wiki/${encodeURIComponent(matched)}`;
      htmlParts.push(
        `[<a href="${wikiUrl}" class="wiki-tag" data-title="${safeTitle}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>]`
      );

      if (!termCounter.has(matched)) {
        termCounter.set(matched, 0);
        termFirstPos.set(matched, i);
      }
      termCounter.set(matched, termCounter.get(matched) + 1);

      i += matched.length;
    } else {
      const char = sanitizedText[i];
      plainParts.push(char);

      // JavaScript injection prevention output escaping:
      // Escapes: ' " \ \n \r \t & < >
      if (char === '&') htmlParts.push('&amp;');
      else if (char === '<') htmlParts.push('&lt;');
      else if (char === '>') htmlParts.push('&gt;');
      else if (char === '"') htmlParts.push('&quot;');
      else if (char === "'") htmlParts.push('&#39;');
      else if (char === '\\') htmlParts.push('&#92;');
      else if (char === '\n') htmlParts.push('<br>\n');
      else if (char === '\r') htmlParts.push('&#13;');
      else if (char === '\t') htmlParts.push('&#9;');
      else htmlParts.push(char);

      i += 1;
    }
  }

  const elapsed = performance.now() - startTime;

  // Build sorted terms list (descending frequency, then by first occurrence)
  const sortedTerms = Array.from(termCounter.entries())
    .sort((a, b) => {
      const freqDiff = b[1] - a[1];
      if (freqDiff !== 0) return freqDiff;
      return (termFirstPos.get(a[0]) || 0) - (termFirstPos.get(b[0]) || 0);
    })
    .map(([term, count]) => ({
      title: term,
      count,
      url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(term)}`
    }));

  let totalTags = 0;
  for (const c of termCounter.values()) {
    totalTags += c;
  }

  return {
    tagged_plain: plainParts.join(''),
    tagged_html: htmlParts.join(''),
    terms: sortedTerms,
    stats: {
      total_characters: n,
      total_tags: totalTags,
      unique_terms: termCounter.size,
      elapsed_ms: Math.round(elapsed * 100) / 100
    }
  };
}

// Handle incoming messages from the main thread
self.onmessage = (event) => {
  const { id, type, text, options, dataPath } = event.data;

  if (type === 'init') {
    loadDictionary(dataPath);
    return;
  }

  if (type === 'tag') {
    if (!isLoaded) {
      postMessage({
        id,
        type: 'tag_result',
        success: false,
        error: '辞書データがまだ読み込み中です。しばらくお待ちください。'
      });
      return;
    }

    try {
      const result = tagText(text, options);
      postMessage({
        id,
        type: 'tag_result',
        success: true,
        data: result
      });
    } catch (err) {
      postMessage({
        id,
        type: 'tag_result',
        success: false,
        error: err.message
      });
    }
  }
};
