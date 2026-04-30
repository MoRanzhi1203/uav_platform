
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

print("=" * 60)
print("测试API接口...")
print("=" * 60)

# 1. 测试风险区域列表
print("\n1. 测试风险区域列表接口...")
try:
    response = requests.get(f"{BASE_URL}/api/terrain/api/dashboard/risk-areas/")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   响应: {json.dumps(data, ensure_ascii=False, indent=2)[:800]}...")
    else:
        print(f"   错误: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")

# 2. 测试测绘记录列表
print("\n2. 测试测绘记录列表接口...")
try:
    response = requests.get(f"{BASE_URL}/api/terrain/api/dashboard/survey-records/")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   响应: {json.dumps(data, ensure_ascii=False, indent=2)[:800]}...")
    else:
        print(f"   错误: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")

# 3. 测试风险分析接口
print("\n3. 测试风险分析接口...")
try:
    response = requests.get(f"{BASE_URL}/api/terrain/api/dashboard/risk-analysis/")
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
    else:
        print(f"   错误: {response.text}")
except Exception as e:
    print(f"   异常: {str(e)}")

print("\n" + "=" * 60)
print("API测试完成！")
print("=" * 60)
