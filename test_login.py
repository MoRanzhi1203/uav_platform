
import requests
import json

# 设置基础URL
BASE_URL = 'http://localhost:8000'

# 创建会话
session = requests.Session()

print('=== 开始自动化测试 ===')
print()

# 1. 获取登录页面获取CSRF token
print('1. 获取登录页面...')
login_page = session.get(f'{BASE_URL}/login/')
print(f'   状态码: {login_page.status_code}')

# 2. 登录
print('2. 登录系统...')
login_url = f'{BASE_URL}/api/system/login/'
login_data = {
    'username': 'admin',
    'password': 'Admin@123456',
    'remember': False
}

# 设置请求头
headers = {
    'Content-Type': 'application/json',
    'X-CSRFToken': session.cookies.get('csrftoken', '')
}

response = session.post(
    login_url,
    json=login_data,
    headers=headers
)

print(f'   登录状态码: {response.status_code}')
print(f'   响应内容: {response.text}')

if response.status_code == 200:
    print('   ✓ 登录成功！')
    print()
    
    # 3. 测试访问林区管理页面
    print('3. 测试访问林区管理页面...')
    forest_page = session.get(f'{BASE_URL}/forest/')
    print(f'   状态码: {forest_page.status_code}')
    if '林区管理' in forest_page.text:
        print('   ✓ 成功访问林区管理页面！')
    else:
        print('   ✗ 未找到"林区管理"标题')
        print(f'   页面标题: {forest_page.text[:200]}')
    print()
    
    # 4. 测试访问农田管理页面
    print('4. 测试访问农田管理页面...')
    agri_page = session.get(f'{BASE_URL}/agri/')
    print(f'   状态码: {agri_page.status_code}')
    if '农田管理' in agri_page.text:
        print('   ✓ 成功访问农田管理页面！')
    else:
        print('   ✗ 未找到"农田管理"标题')
    print()
    
    # 5. 测试访问地形管理页面
    print('5. 测试访问地形管理页面...')
    terrain_page = session.get(f'{BASE_URL}/terrain/')
    print(f'   状态码: {terrain_page.status_code}')
    if '地形管理' in terrain_page.text:
        print('   ✓ 成功访问地形管理页面！')
    else:
        print('   ✗ 未找到"地形管理"标题')
    print()
    
    print('=== 测试完成 ===')
else:
    print('   ✗ 登录失败！')
