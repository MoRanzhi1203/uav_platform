import requests
import json

BASE_URL = "http://127.0.0.1:8000"
LOGIN_URL = f"{BASE_URL}/api/system/login/"
TEST_PAGES = [
    ("/dashboard/", "仪表板"),
    ("/fleet/", "机队管理"),
    ("/fleet/detail/", "机队详情"),
    ("/forest/", "森林管理"),
    ("/forest/detail/", "森林详情"),
    ("/agri/", "农田管理"),
    ("/agri/detail/", "农田详情"),
    ("/tasking/", "任务管理"),
    ("/tasking/detail/", "任务详情"),
    ("/federation/", "联盟管理"),
    ("/telemetry/", "遥测监控"),
    ("/terrain/", "地形管理"),
    ("/terrain/detail/", "地形详情"),
]

def test_login_and_pages():
    session = requests.Session()
    
    print("=" * 60)
    print("开始自动化测试...")
    print("=" * 60)
    
    # 1. 获取登录页面获取CSRF token
    print("\n[1/3] 获取登录页面...")
    login_page_response = session.get(f"{BASE_URL}/login/")
    print(f"登录页面状态码: {login_page_response.status_code}")
    
    # 2. 尝试登录
    print("\n[2/3] 尝试登录...")
    login_data = {
        "username": "admin",
        "password": "Admin@123456",
        "remember": False
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-CSRFToken": session.cookies.get("csrftoken", "")
    }
    
    login_response = session.post(
        LOGIN_URL,
        data=json.dumps(login_data),
        headers=headers
    )
    
    print(f"登录响应状态码: {login_response.status_code}")
    print(f"登录响应内容: {login_response.text}")
    
    if login_response.status_code == 200:
        print("✓ 登录成功！")
    else:
        print("✗ 登录失败！")
        return
    
    # 3. 测试各个页面
    print("\n[3/3] 测试各个页面...")
    print("-" * 60)
    
    success_count = 0
    fail_count = 0
    failed_pages = []
    
    for url, name in TEST_PAGES:
        full_url = f"{BASE_URL}{url}"
        try:
            response = session.get(full_url, allow_redirects=False)
            
            if response.status_code == 200:
                print(f"✓ {name:<15} - 状态码: {response.status_code}")
                success_count += 1
            elif response.status_code == 302:
                print(f"✗ {name:<15} - 状态码: {response.status_code} (重定向到登录页)")
                fail_count += 1
                failed_pages.append((name, url, response.status_code))
            else:
                print(f"✗ {name:<15} - 状态码: {response.status_code}")
                fail_count += 1
                failed_pages.append((name, url, response.status_code))
                
        except Exception as e:
            print(f"✗ {name:<15} - 错误: {str(e)}")
            fail_count += 1
            failed_pages.append((name, url, str(e)))
    
    # 4. 输出结果摘要
    print("-" * 60)
    print("\n测试结果摘要:")
    print(f"  成功: {success_count} 页")
    print(f"  失败: {fail_count} 页")
    
    if failed_pages:
        print("\n失败的页面:")
        for name, url, error in failed_pages:
            print(f"  - {name} ({url}): {error}")
    
    print("=" * 60)
    print("测试完成！")

if __name__ == "__main__":
    test_login_and_pages()
