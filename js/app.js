/**
 * Wikipedia Tagger - Frontend Application Logic
 * 100% Client-Side Static Architecture powered by Web Worker & Streaming GZIP
 */

// Sample Texts Definition (Zero-server client-side data)
const SAMPLE_TEXTS = {
  quantum_ai: {
    title: "量子情報・人工知能 (Quantum Computing & AI)",
    text: "量子力学の原理に基づく量子コンピュータは、重ね合わせや量子もつれを利用して超並列計算を行う次世代計算機である。従来のノイマン型コンピュータや半導体微細化の物理的限界を超える技術として、人工知能における機械学習や深層学習、創薬や新材料開発、RSA暗号などの暗号解読への応用が期待されている。東京大学や理化学研究所などでも超伝導量子ビットを用いた国産量子コンピュータの研究開発が推進されている。"
  },
  history: {
    title: "日本古代史・考古学 (Ancient Japanese History)",
    text: "邪馬台国の女王卑弥呼は、『魏志倭人伝』によれば鬼道に仕え、よく衆を惑わしたとされる。難升米らを帯方郡を通じて洛陽の魏の皇帝曹叡に派遣し、親魏倭王の金印と銅鏡を下賜された。畿内説では大和国の箸墓古墳が卑弥呼の墓と推定され、九州説では吉野ヶ里遺跡や伊都国との関連が議論されている。"
  },
  genetics: {
    title: "分子生物学・ゲノム医療 (Molecular Biology & Genetics)",
    text: "CRISPR-Cas9を用いたゲノム編集技術は、特定のDNA塩基配列を極めて高い精度で切断・改変することを可能にし、分子生物学や遺伝子治療に劇的な変革をもたらした。メッセンジャーRNA（mRNA）ワクチンの実用化やiPS細胞（人工多能性幹細胞）を用いた再生医療と組み合わせることで、遺伝性疾患や悪性腫瘍の根治を目指す臨床応用が進展している。"
  },
  astrophysics: {
    title: "宇宙物理学・天文学 (Astrophysics & Black Holes)",
    text: "一般相対性理論が予言したブラックホールは、光すら脱出できない事象の地平線に囲まれた天体である。イベントホライズンテレスコープ（EHT）国際研究チームは、超長基線電波干渉法（VLBI）を用いてM87銀河中心の超大質量ブラックホールの直接撮像に史上初めて成功した。さらに重力波望遠鏡LIGOやVirgo、日本のKAGRAによる連星ブラックホール合体の観測は、重力波天文学の新時代を切り拓いた。"
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const inputText = document.getElementById('inputText');
  const inputCharCount = document.getElementById('inputCharCount');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const executeBtn = document.getElementById('executeBtn');

  const optFilterStopwords = document.getElementById('optFilterStopwords');
  const optFilterHiragana = document.getElementById('optFilterHiragana');
  const optMinWordLen = document.getElementById('optMinWordLen');
  const optOpenTarget = document.getElementById('optOpenTarget');

  const copyTextBtn = document.getElementById('copyTextBtn');
  const exportHtmlBtn = document.getElementById('exportHtmlBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const resultContent = document.getElementById('resultContent');
  const statsPills = document.getElementById('statsPills');
  const statTotalTags = document.getElementById('statTotalTags');
  const statUniqueTerms = document.getElementById('statUniqueTerms');
  const statElapsed = document.getElementById('statElapsed');

  const termsDrawer = document.getElementById('termsDrawer');
  const termsChipsContainer = document.getElementById('termsChipsContainer');
  const detectedTermsCount = document.getElementById('detectedTermsCount');
  const termSearchInput = document.getElementById('termSearchInput');

  const sampleButtonsContainer = document.getElementById('sampleButtonsContainer');
  const toastNotification = document.getElementById('toastNotification');
  const dbStatusBadge = document.getElementById('dbStatusBadge');
  const dbStatusText = document.getElementById('dbStatusText');

  const loadProgressBar = document.getElementById('loadProgressBar');
  const loadProgressContainer = document.getElementById('loadProgressContainer');
  const loadStatusText = document.getElementById('loadStatusText');

  // Application State
  let isWorkerReady = false;
  let pendingTagRequest = false;
  let currentResult = null;
  let allTermsList = [];
  let tagRequestId = 0;
  const pendingPromises = new Map();

  // =========================================================================
  // Security & Input Validation: 2,000 Characters Limit & Injection Escaping
  // Target Characters: ' " \ \n \r \t & < >
  // =========================================================================
  const MAX_INPUT_LENGTH = 2000;

  /**
   * JavaScript injection prevention: Input-side escape function
   * Escapes dangerous scripting & delimiter characters upon receiving user input
   */
  function escapeSecurityInput(str) {
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
   * JavaScript injection prevention: Output-side escape function
   * Escapes characters when rendering HTML, attributes, or exporting standalone documents
   */
  function escapeSecurityOutput(str) {
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

  // =========================================================================
  // Theme Management (Light / Dark)
  // =========================================================================
  const savedTheme = localStorage.getItem('wiki_tagger_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.body.setAttribute('data-theme', savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('wiki_tagger_theme', newTheme);
  });

  // =========================================================================
  // Web Worker Initialization
  // =========================================================================
  let taggerWorker = null;

  function initWorker() {
    try {
      taggerWorker = new Worker('js/worker.js');

      taggerWorker.onmessage = (e) => {
        const msg = e.data;

        if (msg.type === 'status') {
          if (loadStatusText) loadStatusText.textContent = msg.message;
          dbStatusText.textContent = msg.message;
        } else if (msg.type === 'progress') {
          if (msg.phase === 'downloading') {
            updateProgress(msg.progress, msg.message);
          } else if (msg.phase === 'indexing') {
            updateProgress(100, msg.message);
          }
        } else if (msg.type === 'ready') {
          isWorkerReady = true;
          const countInTenK = Math.round(msg.titlesCount / 10000);
          dbStatusText.textContent = `ダンプ ${countInTenK}万語搭載 (準備完了)`;
          dbStatusBadge.classList.remove('badge-loading');
          dbStatusBadge.classList.add('badge-ready');

          if (loadProgressContainer) {
            loadProgressContainer.style.opacity = '0';
            setTimeout(() => {
              loadProgressContainer.style.display = 'none';
            }, 400);
          }

          // If a tag request was queued during initialization, run it now
          if (pendingTagRequest) {
            pendingTagRequest = false;
            executeTagger();
          }
        } else if (msg.type === 'tag_result') {
          const resolver = pendingPromises.get(msg.id);
          if (resolver) {
            pendingPromises.delete(msg.id);
            if (msg.success) {
              resolver.resolve(msg.data);
            } else {
              resolver.reject(new Error(msg.error));
            }
          }
        } else if (msg.type === 'error') {
          console.error('[Worker Error]', msg.message);
          dbStatusText.textContent = 'データ読込エラー';
          dbStatusBadge.classList.add('badge-error');
          if (loadStatusText) loadStatusText.textContent = msg.message;
          showToast(msg.message);
        }
      };

      taggerWorker.onerror = (err) => {
        console.error('[Worker error event]', err);
        dbStatusText.textContent = 'Worker起動エラー';
        dbStatusBadge.classList.add('badge-error');
      };

      // Trigger dictionary load
      taggerWorker.postMessage({
        type: 'init',
        dataPath: '../data/wikipedia_titles.txt.gz'
      });

    } catch (workerErr) {
      console.error('Failed to instantiate Web Worker:', workerErr);
      dbStatusText.textContent = 'Worker未対応';
      alert('Web Workerの起動に失敗しました。ローカルHTTPサーバー経由でアクセスしてください。');
    }
  }

  function updateProgress(percent, label) {
    if (loadProgressBar) {
      loadProgressBar.style.width = `${percent}%`;
    }
    if (loadStatusText) {
      loadStatusText.textContent = label;
    }
    dbStatusText.textContent = label;
  }

  initWorker();

  // Send tagging request to Worker via Promise
  function requestWorkerTag(text, options) {
    return new Promise((resolve, reject) => {
      const id = ++tagRequestId;
      pendingPromises.set(id, { resolve, reject });
      taggerWorker.postMessage({
        id,
        type: 'tag',
        text,
        options
      });
    });
  }

  // =========================================================================
  // Sample Texts Handling
  // =========================================================================
  sampleButtonsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.sample-chip');
    if (!chip) return;

    const sampleKey = chip.getAttribute('data-sample');
    if (SAMPLE_TEXTS[sampleKey]) {
      inputText.value = SAMPLE_TEXTS[sampleKey].text;
      updateCharCount();
      executeTagger();
      showToast(`「${SAMPLE_TEXTS[sampleKey].title}」を読み込みました`);
    }
  });

  // Character count updates with 2,000 characters limit warning
  function updateCharCount() {
    const len = inputText.value.length;
    inputCharCount.textContent = `${len.toLocaleString()} / ${MAX_INPUT_LENGTH.toLocaleString()} 文字`;

    if (len > MAX_INPUT_LENGTH) {
      inputCharCount.classList.add('char-limit-exceeded');
      inputCharCount.classList.remove('char-limit-warning');
    } else if (len >= MAX_INPUT_LENGTH * 0.9) {
      inputCharCount.classList.add('char-limit-warning');
      inputCharCount.classList.remove('char-limit-exceeded');
    } else {
      inputCharCount.classList.remove('char-limit-warning', 'char-limit-exceeded');
    }
  }
  inputText.addEventListener('input', updateCharCount);

  // Clear button
  clearInputBtn.addEventListener('click', () => {
    inputText.value = '';
    updateCharCount();
    resetResultView();
    inputText.focus();
  });

  function resetResultView() {
    currentResult = null;
    allTermsList = [];
    emptyState.style.display = 'block';
    loadingState.style.display = 'none';
    resultContent.style.display = 'none';
    resultContent.innerHTML = '';
    statsPills.style.display = 'none';
    termsDrawer.style.display = 'none';
    copyTextBtn.disabled = true;
    exportHtmlBtn.disabled = true;
  }

  // Keyboard shortcut: Ctrl+Enter / Cmd+Enter to execute
  inputText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeTagger();
    }
  });

  // Execute button click
  executeBtn.addEventListener('click', executeTagger);

  // =========================================================================
  // Tagging Execution
  // =========================================================================
  async function executeTagger() {
    const rawText = inputText.value;
    if (!rawText || !rawText.trim()) {
      showToast('テキストを入力してください');
      inputText.focus();
      return;
    }

    // 大量データ登録防止: 最大2,000文字のバリデーションチェック
    if (rawText.length > MAX_INPUT_LENGTH) {
      showToast(`入力文字数が上限（${MAX_INPUT_LENGTH.toLocaleString()}文字）を超えています。2,000文字以内で入力してください。`);
      updateCharCount();
      inputText.focus();
      return;
    }

    if (!isWorkerReady) {
      pendingTagRequest = true;
      showToast('辞書データを準備中です...完了次第自動的に実行します');
      loadingState.style.display = 'block';
      emptyState.style.display = 'none';
      return;
    }

    // JavaScriptインジェクション対策: 入力時エスケープ処理を実施
    const text = escapeSecurityInput(rawText.trim());

    // UI State: Loading
    emptyState.style.display = 'none';
    resultContent.style.display = 'none';
    termsDrawer.style.display = 'none';
    loadingState.style.display = 'block';
    executeBtn.disabled = true;

    const options = {
      filter_stopwords: optFilterStopwords.checked,
      filter_hiragana: optFilterHiragana.checked,
      min_word_len: parseInt(optMinWordLen.value, 10)
    };

    try {
      const data = await requestWorkerTag(text, options);
      currentResult = data;
      renderResult(data);
    } catch (err) {
      console.error(err);
      alert('エラーが発生しました: ' + err.message);
      emptyState.style.display = 'block';
    } finally {
      loadingState.style.display = 'none';
      executeBtn.disabled = false;
    }
  }

  // =========================================================================
  // Result Rendering
  // =========================================================================
  function renderResult(data) {
    resultContent.innerHTML = data.tagged_html;
    resultContent.style.display = 'block';

    // Update Stats
    statTotalTags.textContent = data.stats.total_tags.toLocaleString();
    statUniqueTerms.textContent = data.stats.unique_terms.toLocaleString();
    statElapsed.textContent = data.stats.elapsed_ms.toFixed(1);
    statsPills.style.display = 'flex';

    // Enable Buttons
    copyTextBtn.disabled = false;
    exportHtmlBtn.disabled = false;

    // Attach click handlers to tags in text
    attachTagClickHandlers();

    // Render terms list drawer
    allTermsList = data.terms || [];
    renderTermsDrawer(allTermsList);
  }

  function attachTagClickHandlers() {
    const tags = resultContent.querySelectorAll('.wiki-tag');
    tags.forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.preventDefault();
        const url = tag.getAttribute('href');
        const title = tag.getAttribute('data-title');
        openWikipediaArticle(url, title);
      });
    });
  }

  // =========================================================================
  // Wikipedia Popup / Tab Opener
  // =========================================================================
  let wikiPopupWindow = null;

  function openWikipediaArticle(url, title) {
    const targetMode = optOpenTarget.value;

    if (targetMode === 'tab') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Popup window mode (centered, 880x720)
    const w = 880;
    const h = 720;
    const left = Math.max(0, Math.floor((window.screen.width - w) / 2));
    const top = Math.max(0, Math.floor((window.screen.height - h) / 2));
    const windowFeatures = `width=${w},height=${h},top=${top},left=${left},scrollbars=yes,resizable=yes,status=yes,toolbar=no,menubar=no,location=yes`;

    // If window already open, reuse or bring to front
    if (wikiPopupWindow && !wikiPopupWindow.closed) {
      wikiPopupWindow.location.href = url;
      wikiPopupWindow.focus();
    } else {
      wikiPopupWindow = window.open(url, 'wiki_article_popup', windowFeatures);
      if (wikiPopupWindow) {
        wikiPopupWindow.focus();
      }
    }
  }

  // =========================================================================
  // Bottom Terms List & Navigation
  // =========================================================================
  function renderTermsDrawer(terms) {
    detectedTermsCount.textContent = terms.length;
    termsDrawer.style.display = terms.length > 0 ? 'flex' : 'none';
    renderTermChips(terms);
  }

  function renderTermChips(terms) {
    termsChipsContainer.innerHTML = '';

    if (terms.length === 0) {
      termsChipsContainer.innerHTML = '<span style="font-size:0.8rem; color:var(--text-subtle);">一致する用語がありません</span>';
      return;
    }

    terms.forEach(t => {
      const chip = document.createElement('button');
      chip.className = 'term-chip';
      chip.setAttribute('type', 'button');
      const safeTitle = escapeSecurityOutput(t.title);
      chip.setAttribute('data-title', safeTitle);
      chip.innerHTML = `
        <span class="term-chip-title">${safeTitle}</span>
        <span class="term-chip-count">${parseInt(t.count, 10) || 0}</span>
      `;

      // Jump to term in text on click
      chip.addEventListener('click', () => {
        scrollToTermInText(t.title);
      });

      termsChipsContainer.appendChild(chip);
    });
  }

  // Term search / filter in drawer
  termSearchInput.addEventListener('input', () => {
    const q = termSearchInput.value.trim().toLowerCase();
    if (!q) {
      renderTermChips(allTermsList);
      return;
    }
    const filtered = allTermsList.filter(t => t.title.toLowerCase().includes(q));
    renderTermChips(filtered);
  });

  // Scroll to and highlight occurrences of term in text
  function scrollToTermInText(termTitle) {
    const tags = resultContent.querySelectorAll(`.wiki-tag[data-title="${CSS.escape(termTitle)}"]`);
    if (tags.length === 0) return;

    const firstTag = tags[0];
    firstTag.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add pulse highlight animation to all matching tags
    tags.forEach(tag => {
      tag.classList.remove('term-highlight-pulse');
      void tag.offsetWidth; // trigger reflow
      tag.classList.add('term-highlight-pulse');
      setTimeout(() => {
        tag.classList.remove('term-highlight-pulse');
      }, 1500);
    });
  }

  // =========================================================================
  // Copy Plain Text ([用語] format)
  // =========================================================================
  copyTextBtn.addEventListener('click', async () => {
    if (!currentResult || !currentResult.tagged_plain) return;

    try {
      await navigator.clipboard.writeText(currentResult.tagged_plain);
      showToast('[]付き注釈テキストをコピーしました');
    } catch (err) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = currentResult.tagged_plain;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('[]付き注釈テキストをコピーしました');
    }
  });

  // =========================================================================
  // Export Standalone HTML (100% Client-Side Blob Generation)
  // =========================================================================
  exportHtmlBtn.addEventListener('click', () => {
    if (!currentResult) return;

    try {
      const title = 'Wikipedia注釈付きドキュメント';
      const terms = currentResult.terms || [];
      const termsChipsHtml = terms
        .map(t => {
          const safeTitle = escapeSecurityOutput(t.title);
          const safeUrl = `https://ja.wikipedia.org/wiki/${encodeURIComponent(t.title)}`;
          return `<a href="${safeUrl}" class="term-chip" target="_blank" rel="noopener noreferrer">${safeTitle} (${parseInt(t.count, 10) || 0})</a>`;
        })
        .join('');

      const htmlDoc = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Wikipediaタガー処理結果</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #4338ca;
      --border: #e2e8f0;
      --tag-bg: #eef2ff;
      --tag-border: #c7d2fe;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --card-bg: #1e293b;
        --text: #f1f5f9;
        --text-muted: #94a3b8;
        --primary: #818cf8;
        --border: #334155;
        --tag-bg: #312e81;
        --tag-border: #4338ca;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans JP", sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.8;
      margin: 0;
      padding: 2.5rem 1rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    h1 {
      font-size: 1.6rem;
      margin-top: 0;
      color: var(--primary);
      border-bottom: 2px solid var(--border);
      padding-bottom: 0.8rem;
    }
    .content {
      font-size: 1.1rem;
      line-height: 2.1;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .wiki-tag {
      display: inline-block;
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      background: var(--tag-bg);
      border: 1px solid var(--tag-border);
      border-radius: 4px;
      margin: 0 2px;
      transition: all 0.15s ease;
    }
    .wiki-tag:hover {
      background: var(--primary);
      color: #ffffff;
      text-decoration: none;
      transform: translateY(-1px);
    }
    .terms-box {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    .terms-box h3 {
      font-size: 1.1rem;
      margin-bottom: 1rem;
      color: var(--text);
    }
    .term-chip {
      display: inline-block;
      margin: 4px 6px 4px 0;
      padding: 4px 12px;
      background: var(--tag-bg);
      border: 1px solid var(--tag-border);
      border-radius: 20px;
      font-size: 0.85rem;
      color: var(--primary);
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .term-chip:hover {
      background: var(--primary);
      color: #fff;
    }
    .footer {
      margin-top: 2.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      text-align: center;
    }
  </style>
  <script>
    function openWikiPopup(url) {
      var w = 880;
      var h = 720;
      var left = Math.max(0, Math.floor((screen.width - w) / 2));
      var top = Math.max(0, Math.floor((screen.height - h) / 2));
      window.open(url, 'wiki_popup', 'width=' + w + ',height=' + h + ',top=' + top + ',left=' + left + ',scrollbars=yes,resizable=yes');
      return false;
    }
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.wiki-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
          e.preventDefault();
          openWikiPopup(tag.getAttribute('href'));
        });
      });
    });
  <\/script>
</head>
<body>
  <div class="container">
    <h1>Wikipediaタガー 注釈結果</h1>
    <div class="content">${currentResult.tagged_html}</div>
    <div class="terms-box">
      <h3>注釈された用語一覧 (${terms.length} 語)</h3>
      <div>${termsChipsHtml}</div>
    </div>
    <div class="footer">
      Generated by Wikipedia Tagger (Client-Side Static Engine)
    </div>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wikipedia_tagged_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('HTMLファイルをダウンロードしました');
    } catch (err) {
      alert('HTMLエクスポートに失敗しました: ' + err.message);
    }
  });

  // =========================================================================
  // Utilities & Helpers
  // =========================================================================
  let toastTimer = null;
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toastNotification.textContent = message;
    toastNotification.classList.add('show');
    toastTimer = setTimeout(() => {
      toastNotification.classList.remove('show');
    }, 2800);
  }

  /**
   * Safe HTML Entity Escape (wraps escapeSecurityOutput)
   */
  function escapeHtml(str) {
    return escapeSecurityOutput(str);
  }
});
