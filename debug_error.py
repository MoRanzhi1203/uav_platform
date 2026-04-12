import requests
import json

BASE_URL = "http://127.0.0.1:8000"
LOGIN_URL = f"{BASE_URL}/api/system/login/"
TEST_URL = f"{BASE_URL}/forest/"

session = requests.Session()

# 登录
login_page = session.get(f"{BASE_URL}/login/")
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
print("登录成功！")

# 请求森林管理页面，获取详细错误
print(f"\n请求页面: {TEST_URL}")
response = session.get(TEST_URL)
print(f"状态码: {response.status_code}")

# 保存响应到文件以便查看
with open('error_page.html', 'w', encoding='utf-8') as f:
    f.write(response.text)
print("\n错误页面已保存到 error_page.html")

# 查找关键错误信息
if 'TemplateSyntaxError' in response.text:
    print("\n发现 TemplateSyntaxError！")
    # 简单提取错误
    lines = response.text.split('\n')
    for i, line in enumerate(lines):
        if 'TemplateSyntaxError' in line:
            print(f"\n错误位置第 {i} 行附近:")
            for j in range(max(0, i-10), min(len(lines), i+20)):
                print(f"{j+1:4d}: {lines[j]}")
            break
