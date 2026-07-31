"""每天早上8点自动抓取抖音、知乎、微博、B站等平台热点，保存为 hot_data.json
在 GitHub Actions 上运行，使用各平台官方 API + 备用聚合 API。
"""
import json
import urllib.request
import urllib.error
import os
import ssl
from datetime import datetime

OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hot_data.json')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def fetch_json(url, timeout=20, headers=None):
    try:
        h = headers or HEADERS
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            return json.loads(raw)
    except Exception as e:
        print(f'  [WARN] fetch failed: {url} -> {e}')
        return None


def fetch_bilibili():
    """B站官方 API"""
    url = 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all'
    print('  Fetching B站热门 from official API...')
    data = fetch_json(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.bilibili.com',
    })
    if not data:
        return []
    if data.get('code') != 0:
        print(f'  B站 API code: {data.get("code")}, message: {data.get("message", "")}')
        return []
    items = []
    for item in data.get('data', {}).get('list', [])[:15]:
        title = item.get('title', '')
        hot = item.get('score', item.get('like', ''))
        bvid = item.get('bvid', '')
        link = f'https://www.bilibili.com/video/{bvid}' if bvid else ''
        if title:
            items.append({'title': title, 'hot': str(hot) if hot else '', 'url': link})
    return items


def fetch_weibo():
    """微博热搜 API"""
    url = 'https://weibo.com/ajax/side/hotSearch'
    print('  Fetching 微博热搜 from official API...')
    data = fetch_json(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://weibo.com',
    })
    if not data:
        return []
    items = []
    raw = data.get('data', {}).get('realtime', [])
    for item in raw[:15]:
        title = item.get('word', item.get('note', ''))
        hot = item.get('num', '')
        link = f'https://s.weibo.com/weibo?q=%23{title}%23' if title else ''
        if title:
            items.append({'title': title, 'hot': str(hot) if hot else '', 'url': link})
    return items


def fetch_zhihu():
    """知乎热榜 API"""
    url = 'https://www.zhihu.com/api/v3/topstory/hot-lists/total?limit=15'
    print('  Fetching 知乎热榜 from official API...')
    data = fetch_json(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://www.zhihu.com/hot',
    })
    if not data:
        return []
    items = []
    raw = data.get('data', [])
    for item in raw[:15]:
        target = item.get('target', {})
        title = target.get('title', '')
        hot = item.get('detail_text', '')
        link = target.get('url', '')
        if link and not link.startswith('http'):
            link = f'https://www.zhihu.com{link}'
        if title:
            items.append({'title': title, 'hot': str(hot) if hot else '', 'url': link})
    return items


def fetch_douyin():
    """抖音热榜 - 尝试多个 API"""
    apis = [
        ('https://api-hot.imsyy.top/douyin', 'imsyy'),
        ('https://api.vvhan.com/api/hotlist/douyin', 'vvhan'),
    ]
    for url, name in apis:
        print(f'  Fetching 抖音热榜 from {name}...')
        data = fetch_json(url)
        if data:
            raw_items = data.get('data', []) if isinstance(data, dict) else []
            items = []
            for item in raw_items[:15]:
                title = item.get('title', '')
                hot = item.get('hot', '')
                link = item.get('url', '')
                if title:
                    items.append({'title': title, 'hot': str(hot) if hot else '', 'url': link})
            if items:
                return items
    return []


def fetch_xiaohongshu():
    """小红书热榜 - 尝试多个 API"""
    apis = [
        ('https://api-hot.imsyy.top/xiaohongshu', 'imsyy'),
        ('https://api.vvhan.com/api/hotlist/xhs', 'vvhan'),
    ]
    for url, name in apis:
        print(f'  Fetching 小红书热榜 from {name}...')
        data = fetch_json(url)
        if data:
            raw_items = data.get('data', []) if isinstance(data, dict) else []
            items = []
            for item in raw_items[:15]:
                title = item.get('title', '')
                hot = item.get('hot', '')
                link = item.get('url', '')
                if title:
                    items.append({'title': title, 'hot': str(hot) if hot else '', 'url': link})
            if items:
                return items
    return []


def main():
    print(f'=== Hot Data Fetch {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} ===')

    result = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'sources': {}
    }

    fetchers = [
        ('bilibili', 'B站热门', fetch_bilibili),
        ('weibo', '微博热搜', fetch_weibo),
        ('zhihu', '知乎热榜', fetch_zhihu),
        ('douyin', '抖音热榜', fetch_douyin),
        ('xiaohongshu', '小红书热榜', fetch_xiaohongshu),
    ]

    for key, label, fetcher in fetchers:
        try:
            items = fetcher()
        except Exception as e:
            print(f'  {label} error: {e}')
            items = []
        if items:
            print(f'  {label}: {len(items)} 条')
        else:
            print(f'  {label}: 获取失败，使用空列表')
        result['sources'][key] = items

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in result['sources'].values())
    print(f'\nSaved to {OUT_PATH}')
    print(f'Total sources: {len(result["sources"])}, items: {total}')
    print(f'Date: {result["date"]}, Update time: {result["update_time"]}')


if __name__ == '__main__':
    main()
