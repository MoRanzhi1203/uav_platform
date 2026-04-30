
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

print("=" * 60)
print("测试地形模块 API - 逐个测试")
print("=" * 60)

# 1. 测试风险区域列表
print("\n1. 测试风险区域列表接口:")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/risk-areas/?page=1&page_size=10")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   成功! 数据项数: {len(data.get('data', {}).get('items', []))}")
    else:
        print(f"   响应内容: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")
    import traceback
    traceback.print_exc()

# 2. 测试风险分析接口
print("\n2. 测试风险分析接口:")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/risk-analysis/")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   成功!")
    else:
        print(f"   响应内容: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")
    import traceback
    traceback.print_exc()

# 3. 测试测绘记录列表 - 可能是这个导致崩溃
print("\n3. 测试测绘记录列表接口:")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/dashboard/survey-records/?page=1&page_size=10")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   成功! 数据项数: {len(data.get('data', {}).get('items', []))}")
    else:
        print(f"   响应内容: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("API 测试完成")
print("=" * 60)
