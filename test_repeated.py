
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import time

BASE_URL = "http://127.0.0.1:8000"
TEST_TIMES = 5

print("=" * 70)
print(f"重复压力测试 - 每个 API 访问 {TEST_TIMES} 次")
print("=" * 70)

apis = [
    ("地形区域列表", "/terrain/api/areas/"),
    ("风险区域列表", "/terrain/api/dashboard/risk-areas/?page=1&page_size=10"),
    ("风险分析", "/terrain/api/dashboard/risk-analysis/"),
    ("测绘记录", "/terrain/api/dashboard/survey-records/?page=1&page_size=10"),
]

all_success = True

for name, path in apis:
    print(f"\n📊 测试: {name}")
    for i in range(1, TEST_TIMES+1):
        try:
            response = requests.get(f"{BASE_URL}{path}")
            if response.status_code == 200:
                print(f"   ✓ 第 {i} 次: 200 OK")
            else:
                print(f"   ✗ 第 {i} 次: {response.status_code}")
                all_success = False
            time.sleep(0.5)
        except Exception as e:
            print(f"   ✗ 第 {i} 次: 异常 - {str(e)}")
            all_success = False
            break

print("\n" + "=" * 70)
if all_success:
    print("✅ 重复测试完成 - 所有请求都成功！")
else:
    print("❌ 重复测试完成 - 有错误发生")
print("=" * 70)
