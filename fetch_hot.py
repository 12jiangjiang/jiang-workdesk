"""每天早上8点自动抓取抖音、小红书、知乎等平台热点，保存为 hot_data.json
在 GitHub Actions 上运行，不受本地网络限制。
"""
import json
import urllib.request
import urllib.error
import os
from datetime import datetime

OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hot_data.json')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
}


def fetch_json(url, timeout=15):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f'  [WARN] fetch failed: {url} -> {e}')
        return None


def fetch_vvhan(type_name, type_label):
    """vvhan 热榜 API (https://api.vvhan.com)"""
    url = f'https://api.vvhan.com/api/hotlist/{type_name}'
    print(f'  Fetching {type_label} from vvhan...')
    data = fetch_json(url)
    if not data:
        return []
    items = []
    raw_items = data.get('data', []) if isinstance(data, dict) else []
    for item in raw_items[:15]:
        title = item.get('title', '')
        hot = item.get('hot', '')
        link = item.get('url') or item.get('mob_url', '')
        if title:
            items.append({
                'title': title,
                'hot': str(hot) if hot else '',
                'url': link
            })
    return items


def fetch_ressing(type_name, type_label):
    """ressing.cn 热榜 API (备选)"""
    url = f'https://api.ressing.cn/hot/{type_name}'
    print(f'  Fetching {type_label} from ressing...')
    data = fetch_json(url)
    if not data:
        return []
    items = []
    raw_items = data.get('data', []) if isinstance(data, dict) else []
    for item in raw_items[:15]:
        title = item.get('title', '')
        hot = item.get('hot', '')
        link = item.get('url', '')
        if title:
            items.append({
                'title': title,
                'hot': str(hot) if hot else '',
                'url': link
            })
    return items


def fetch_source(key, vvhan_name, ressing_name, label):
    """尝试从多个源获取数据"""
    items = fetch_vvhan(vvhan_name, label)
    if not items:
        items = fetch_ressing(ressing_name, label)
    if not items:
        print(f'  {label}: 获取失败，使用空列表')
    else:
        print(f'  {label}: {len(items)} 条')
    return items


def main():
    print(f'=== Hot Data Fetch {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} ===')

    result = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'sources': {}
    }

    # 抖音热榜
    result['sources']['douyin'] = fetch_source('douyin', 'douyin', 'douyin', '抖音热榜')

    # 小红书热榜
    result['sources']['xiaohongshu'] = fetch_source('xhs', 'xhs', 'xiaohongshu', '小红书热榜')

    # 知乎热榜
    result['sources']['zhihu'] = fetch_source('zhihu', 'zhihu', 'zhihu', '知乎热榜')

    # 微博热搜
    result['sources']['weibo'] = fetch_source('wb', 'wb', 'wb', '微博热搜')

    # B站热门
    result['sources']['bilibili'] = fetch_source('bilibili', 'bili', 'bilibili', 'B站热门')

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in result['sources'].values())
    print(f'\nSaved to {OUT_PATH}')
    print(f'Total sources: {len(result["sources"])}, items: {total}')
    print(f'Date: {result["date"]}, Update time: {result["update_time"]}')


if __name__ == '__main__':
    main()
