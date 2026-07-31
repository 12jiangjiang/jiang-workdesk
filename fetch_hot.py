"""每天早上8点自动抓取抖音、知乎、微博、B站等平台热点，保存为 hot_data.json
在 GitHub Actions 上运行，使用各平台官方 API。
"""
import json
import urllib.request
import urllib.error
import os
import ssl
from datetime import datetime

OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hot_data.json')

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def fetch_json(url, timeout=20, headers=None):
    try:
        h = headers or {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
        }
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            return json.loads(raw)
    except Exception as e:
        print(f'  [WARN] fetch failed: {url} -> {e}')
        return None


def fetch_bilibili():
    """B站官方 API - 使用热门视频接口"""
    # 使用热门视频接口，不需要 Cookie
    url = 'https://api.bilibili.com/x/web-interface/popular?ps=15&pn=1'
    print('  Fetching B站热门 from official API...')
    data = fetch_json(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.bilibili.com',
        'Origin': 'https://www.bilibili.com',
    })
    if not data:
        return []
    if data.get('code') != 0:
        print(f'  B站 API code: {data.get("code")}, msg: {data.get("message", "")}')
        # 备用: 排行榜接口
        url2 = 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all'
        data = fetch_json(url2, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.bilibili.com',
        })
        if not data or data.get('code') != 0:
            print(f'  B站 backup API also failed')
            return []
        raw_list = data.get('data', {}).get('list', [])
    else:
        raw_list = data.get('data', {}).get('list', [])
    items = []
    for item in raw_list[:15]:
        title = item.get('title', '')
        hot = item.get('score', item.get('stat', {}).get('view', ''))
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
    """知乎热榜 API - 使用首页热榜"""
    # 知乎 API 需要特定的 headers
    url = 'https://www.zhihu.com/api/v3/topstory/hot-lists/total?limit=15'
    print('  Fetching 知乎热榜 from official API...')
    data = fetch_json(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://www.zhihu.com/hot',
        'x-requested-with': 'fetch',
    })
    if not data:
        # 备用: 知乎日报
        url2 = 'https://news-at.zhihu.com/api/3/news/latest'
        print('  Trying zhihu daily...')
        data = fetch_json(url2, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
        })
        if not data:
            return []
        items = []
        for item in data.get('stories', [])[:15]:
            title = item.get('title', '')
            link = item.get('url', '')
            if title:
                items.append({'title': title, 'hot': '', 'url': link})
        return items
    
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
    """抖音热榜 - 使用 uapis.cn 聚合 API"""
    url = 'https://uapis.cn/api/v1/misc/hotboard?type=douyin'
    print('  Fetching 抖音热榜 from uapis.cn...')
    data = fetch_json(url)
    if not data:
        return []
    raw_items = data.get('list', [])
    items = []
    for item in raw_items[:15]:
        title = item.get('title', '')
        hot = item.get('hot_value', '')
        link = item.get('url', '')
        if title:
            items.append({'title': title, 'hot': str(hot) if hot else '', 'url': link})
    return items


def fetch_xiaohongshu():
    """小红书热榜 - 使用 uapis.cn 聚合 API"""
    url = 'https://uapis.cn/api/v1/misc/hotboard?type=xiaohongshu'
    print('  Fetching 小红书热榜 from uapis.cn...')
    data = fetch_json(url)
    if not data:
        return []
    raw_items = data.get('list', [])
    items = []
    for item in raw_items[:15]:
        title = item.get('title', '')
        hot = item.get('hot_value', '')
        link = item.get('url', '')
        if title:
            items.append({'title': title, 'hot': str(hot) if hot else '', 'url': link})
    return items


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
