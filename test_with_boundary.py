
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import sys

BASE_URL = "http://127.0.0.1:8000"
print("=" * 70)
print("测试边界数据是否返回")
print("=" * 70)

print("\n获取区域列表...")
try:
    response = requests.get(f"{BASE_URL}/terrain/api/areas/")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        areas = result.get('data', [])
        print(f"区域数量: {len(areas)}")
        
        for idx, area in enumerate(areas[:3]):
            print(f"\n区域 {idx+1}: {area.get('name')}")
            print(f"  ID: {area.get('id')}")
            boundary = area.get('boundary_json')
            if boundary:
                print(f"  边界数据: 有！类型: {type(boundary)}")
                if isinstance(boundary, dict):
                    print(f"  边界键: {list(boundary.keys())}")
            else:
                print(f"  边界数据: 无")
                
            print(f"  中心点: {area.get('center_lng')}, {area.get('center_lat')}")
        
        print("\n✅ 边界数据测试完成！")
    else:
        print(f"错误: {response.text}")
except Exception as e:
    print(f"异常: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
