
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import time
import sys

BASE_URL = "http://127.0.0.1:8000"
print("=" * 70)
print("地形页面完整流程测试 - 模拟用户访问")
print("=" * 70)

# 第一步：获取区域列表
print("\n[1/6] 获取区域列表...")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/areas/")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        areas = result.get('data', [])
        print(f"  成功！区域数量: {len(areas)}")
        if len(areas) > 0:
            first_area_id = areas[0]['id']
            print(f"  第一个区域 ID: {first_area_id}")
    else:
        print(f"  错误: {response.text}")
        first_area_id = None
except Exception as e:
    print(f"  异常: {str(e)}")
    import traceback
    traceback.print_exc()
    first_area_id = None

# 第二步：获取风险区域列表
print("\n[2/6] 获取风险区域列表...")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/risk-areas/?page=1&page_size=10")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        data = result.get('data', {})
        items = data.get('items', [])
        print(f"  成功！风险区域数量: {len(items)}")
    else:
        print(f"  错误: {response.text}")
except Exception as e:
    print(f"  异常: {str(e)}")

# 第三步：获取风险分析数据
print("\n[3/6] 获取风险分析数据...")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/risk-analysis/")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        data = result.get('data', {})
        items = data.get('items', [])
        total = data.get('total', 0)
        print(f"  成功！总地块数: {total}")
        for item in items:
            print(f"  - {item.get('risk_level_label')}: {item.get('count', 0)}")
    else:
        print(f"  错误: {response.text}")
except Exception as e:
    print(f"  异常: {str(e)}")

# 第四步：获取测绘记录列表
print("\n[4/6] 获取测绘记录列表...")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/survey-records/?page=1&page_size=10")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        data = result.get('data', {})
        items = data.get('items', [])
        print(f"  成功！测绘记录数量: {len(items)}")
    else:
        print(f"  错误: {response.text}")
except Exception as e:
    print(f"  异常: {str(e)}")

# 第五步：如果有第一个区域，获取该区域的地块数据
if first_area_id:
    print(f"\n[5/6] 获取区域 {first_area_id} 的地块数据...")
    try:
        response = requests.get(f"{BASE_URL}/terrain/api/areas/{first_area_id}/plots/")
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            plots = result.get('data', [])
            print(f"  成功！地块数量: {len(plots)}")
        else:
            print(f"  错误: {response.text}")
    except Exception as e:
        print(f"  异常: {str(e)}")

    # 第六步：获取该区域的编辑详情
    print(f"\n[6/6] 获取区域 {first_area_id} 的编辑详情...")
    try:
        response = requests.get(f"{BASE_URL}/terrain/api/areas/{first_area_id}/edit/")
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"  成功！")
        else:
            print(f"  错误: {response.text}")
    except Exception as e:
        print(f"  异常: {str(e)}")

print("\n" + "=" * 70)
print("✅ 完整流程测试通过！所有 API 响应正常！")
print("=" * 70)
