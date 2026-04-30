
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import time
import sys

# 设置输出编码
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"
TEST_TIMES = 5

print("=" * 70)
print("Repeated Stress Test - Access each API {} times".format(TEST_TIMES))
print("=" * 70)

apis = [
    ("Terrain Area List", "/terrain/api/areas/"),
    ("Risk Areas", "/terrain/api/dashboard/risk-areas/?page=1&page_size=10"),
    ("Risk Analysis", "/terrain/api/dashboard/risk-analysis/"),
    ("Survey Records", "/terrain/api/dashboard/survey-records/?page=1&page_size=10"),
]

all_success = True

for name, path in apis:
    print("\nTesting: {}".format(name))
    for i in range(1, TEST_TIMES+1):
        try:
            response = requests.get(f"{BASE_URL}{path}")
            if response.status_code == 200:
                print("  [OK] Attempt {}: 200".format(i))
            else:
                print("  [FAIL] Attempt {}: {}".format(i, response.status_code))
                all_success = False
            time.sleep(0.5)
        except Exception as e:
            print("  [ERROR] Attempt {}: {}".format(i, str(e)))
            all_success = False
            break

print("\n" + "=" * 70)
if all_success:
    print("[SUCCESS] All repeated requests passed!")
else:
    print("[FAIL] Some errors occurred")
print("=" * 70)
