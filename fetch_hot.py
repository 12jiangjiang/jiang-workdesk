"""每天早上8点自动抓取抖音、知乎、微博、B站等平台热点，保存为 hot_data.json
在 GitHub Actions 上运行，使用 DailyHotApi 聚合接口。
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

# DailyHotApi 聚合接口
DAILYHOT_BASE = 'https://api-hot.imsyy.top'


def fetch_json(url, timeout=20):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f'  [WARN] fetch failed: {url} -> {e}')
        return None


def fetch_dailyhot(platform, label):
    """从 DailyHotApi 获取热榜数据"""
    url = f'{DAILYHOT_BASE}/{platform}?cache=false'
    print(f'  Fetching {label} from DailyHotApi...')
    data = fetch_json(url)
    if not data:
        return []

    # DailyHotApi 返回格式: {"code": 200, "data": [...]}
    raw_items = data.get('data', []) if isinstance(data, dict) else []
    items = []
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


def fetch_bilibili_official(label):
    """B站官方 API (备用)"""
    url = 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all&limit=15'
    print(f'  Fetching {label} from B站官方 API...')
    data = fetch_json(url)
    if not data or data.get('code') != 0:
        return []
    items = []
    for item in data.get('data', {}).get('list', [])[:15]:
        title = item.get('title', '')
        hot = item.get('score', item.get('like', ''))
        bvid = item.get('bvid', '')
        link = f'https://www.bilibili.com/video/{bvid}' if bvid else ''
        if title:
            items.append({
                'title': title,
                'hot': str(hot) if hot else '',
                'url': link
            })
    return items


def fetch_source(platform, label, fallback=None):
    """从 DailyHotApi 获取，失败时尝试备用源"""
    items = fetch_dailyhot(platform, label)
    if not items and fallback:
        items = fallback(label)
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
    result['sources']['douyin'] = fetch_source('douyin', '抖音热榜')

    # 小红书热榜 (DailyHotApi 暂无小红书，用抖音数据替代)
    result['sources']['xiaohongshu'] = []

    # 知乎热榜
    result['sources']['zhihu'] = fetch_source('zhihu', '知乎热榜')

    # 微博热搜
    result['sources']['weibo'] = fetch_source('weibo', '微博热搜')

    # B站热门 (DailyHotApi + 官方 API 备用)
    result['sources']['bilibili'] = fetch_source('bilibili', 'B站热门', fallback=fetch_bilibili_official)

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in result['sources'].values())
    print(f'\nSaved to {OUT_PATH}')
    print(f'Total sources: {len(result["sources"])}, items: {total}')
    print(f'Date: {result["date"]}, Update time: {result["update_time"]}')


if __name__ == '__main__':
    main()
