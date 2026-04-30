
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

print("=" * 70)
print("测试所有地形管理模块API")
print("=" * 70)

# 1. 测试地形区域列表
print("\n1. 测试地形区域列表 API (/terrain/api/areas/):")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/areas/")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        areas = data.get('data', [])
        print(f"   成功! 区域数量: {len(areas)}")
        for i, area in enumerate(areas[:3]):
            print(f"   - {i+1}. {area.get('name', 'Unknown')} - {area.get('plot_count', 0)} 个地块")
        if len(areas) > 3:
            print(f"   ... 还有 {len(areas)-3} 个区域")
    else:
        print(f"   响应: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")
    import traceback
    traceback.print_exc()

# 2. 测试风险区域列表
print("\n2. 测试风险区域列表 API:")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/risk-areas/?page=1&page_size=10")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        items = data.get('data', {}).get('items', [])
        print(f"   成功! 数据项数: {len(items)}")
        for i, item in enumerate(items[:3]):
            print(f"   - {i+1}. {item.get('plot_name', 'Unknown')} - {item.get('risk_level_label', 'N/A')}")
    else:
        print(f"   响应: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")

# 3. 测试风险分析
print("\n3. 测试风险分析 API:")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/risk-analysis/")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   成功!")
        analysis = data.get('data', {})
        items = analysis.get('items', [])
        for item in items:
            print(f"   - {item.get('risk_level_label', 'N/A')}: {item.get('count', 0)}")
        print(f"   总计: {analysis.get('total', 0)}")
    else:
        print(f"   响应: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")

# 4. 测试测绘记录列表
print("\n4. 测试测绘记录列表 API:")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/survey-records/?page=1&page_size=10")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        items = data.get('data', {}).get('items', [])
        print(f"   成功! 数据项数: {len(items)}")
        for i, item in enumerate(items[:3]):
            print(f"   - {i+1}. {item.get('task_name', 'Unknown')} - {item.get('status_label', 'N/A')}")
    else:
        print(f"   响应: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")

print("\n" + "=" * 70)
print("所有 API 测试完成！")
print("=" * 70)
