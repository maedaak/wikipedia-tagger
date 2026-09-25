import gzip
import re
import os
import sys
import time

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Basic vocabulary / stop words (common particles, auxiliary verbs, highly frequent basic words)
# Based on Wiktionary Basic 1000 & common Japanese grammatical words
STOPWORDS = {
    # Pronouns & demonstratives
    'これ', 'それ', 'あれ', 'どれ', 'ここ', 'そこ', 'あそこ', 'どこ', 'こちら', 'そちら', 'あちら', 'どちら',
    '私', 'わたくし', '僕', '俺', '自分', 'あなた', '彼', '彼女', '誰', '何',
    # Formal / auxiliary nouns
    'こと', 'もの', 'とき', 'ため', 'よう', 'そう', 'どう', 'ところ', 'わけ', 'はず', 'つもり',
    'とおり', 'まま', 'ほう', 'なか', 'うえ', 'した', 'まえ', 'あと', 'ほか', 'あいだ',
    # Highly frequent basic verbs
    'する', 'ある', 'いる', 'なる', 'れる', 'られる', 'せる', 'させる',
    'いく', 'くる', 'みる', 'いう', 'おもう', 'きく', 'はなす', 'わかる', 'できる', 'しる',
    'もつ', 'おく', 'だす', 'はいる', 'でる', 'あがる', 'さがる', 'つく', 'つくる',
    '行う', 'おこなう', '進める', 'もたらす', '記述する', '利用する', '研究する', '期待される',
    # Common conjunctions & adverbs
    'また', 'および', 'しかし', 'そして', 'さらに', 'ただし', 'なお', 'あるいは', 'または',
    'とても', 'たいへん', 'いつも', 'すでに', 'もっと', 'ほぼ', 'かなり', 'まったく',
    'から', 'まで', 'より', 'だけ', 'ほど', 'ばかり', 'くらい', 'など', 'でも', 'とか',
    'といった', 'における', 'について', 'として', 'によって', 'により', 'に対して', 'に関して', 'という',
    'である', '特有', '一般的', '現在', '今日', '近年', '基礎', '重要', '可能', '先端', '次世代',
    # Counters & numbers
    '一つ', '二つ', '三つ', '一人', '二人', '一日', '一年', '一月', '一度', '一回',
    '日', '年', '月', '時', '分', '秒', '回', '度', '人', '個', '本', '枚', '台'
}

HIRAGANA_REGEX = re.compile(r'^[\u3040-\u309F]+$')

def process_dump(gz_path, output_txt_path):
    print(f"Reading from {gz_path}...")
    start_time = time.time()
    
    valid_titles = set()
    total_lines = 0
    skipped_disambig = 0
    skipped_spaces = 0
    skipped_short = 0
    skipped_stopwords = 0

    with gzip.open(gz_path, 'rt', encoding='utf-8', errors='ignore') as f:
        for line in f:
            total_lines += 1
            title = line.strip()
            if not title or title == 'page_title':
                continue
            
            # Skip disambiguation
            if '(' in title or ')' in title or '（' in title or '）' in title:
                skipped_disambig += 1
                continue
            
            # Skip titles with spaces or underscores (as per reference app guideline #1)
            if ' ' in title or '_' in title:
                skipped_spaces += 1
                continue

            # Length must be >= 2 characters
            if len(title) <= 1:
                skipped_short += 1
                continue

            # Skip pure hiragana words of length <= 3 (guideline #2 & grammatical noise)
            if HIRAGANA_REGEX.match(title) and len(title) <= 3:
                skipped_stopwords += 1
                continue

            # Skip common basic stop words (guideline #3)
            if title in STOPWORDS:
                skipped_stopwords += 1
                continue

            valid_titles.add(title)

    print(f"Total lines read: {total_lines}")
    print(f"Filtered out: disambig={skipped_disambig}, spaces={skipped_spaces}, short={skipped_short}, stopwords={skipped_stopwords}")
    print(f"Remaining high-quality Wikipedia titles: {len(valid_titles)} ({time.time() - start_time:.2f}s)")

    # Sort titles by alphabetical order for consistent packing
    sorted_titles = sorted(list(valid_titles))

    # Save as compressed gzipped text file (for fast streaming load in Web Worker)
    print(f"Writing to {output_txt_path}...")
    with gzip.open(output_txt_path, 'wt', encoding='utf-8') as out_f:
        for t in sorted_titles:
            out_f.write(t + '\n')
    txt_size = os.path.getsize(output_txt_path)
    print(f"Saved {output_txt_path} ({txt_size / (1024*1024):.2f} MB)")

if __name__ == '__main__':
    gz_input = 'jawiki-latest-all-titles-in-ns0.gz'
    os.makedirs('data', exist_ok=True)
    out_txt = os.path.join('data', 'wikipedia_titles.txt.gz')
    process_dump(gz_input, out_txt)
