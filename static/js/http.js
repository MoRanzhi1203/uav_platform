// HTTP 请求封装

// 获取 CSRF 令牌
function getCsrfToken() {
    const token = $('input[name="csrfmiddlewaretoken"]').val();
    if (token) {
        return token;
    }
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
}

// 基础请求配置
const defaultOptions = {
    headers: {
        'X-CSRFToken': getCsrfToken(),
        'Content-Type': 'application/json'
    },
    dataType: 'json',
    timeout: 10000
};

// 错误处理函数
function handleError(xhr, status, error) {
    console.error('Ajax error:', error);
    
    if (xhr.status === 401) {
        // 未授权，跳转到登录页
        window.location.href = '/login/';
    } else if (xhr.status === 403) {
        Common.showMessage('权限不足', 'error');
    } else if (xhr.status === 404) {
        Common.showMessage('资源不存在', 'error');
    } else if (xhr.status === 500) {
        Common.showMessage('服务器内部错误', 'error');
    } else {
        Common.showMessage('操作失败，请重试', 'error');
    }
}

// 响应处理函数
function handleResponse(response, successCallback) {
    if (response.code === 0) {
        successCallback(response.data);
    } else {
        Common.showMessage(response.msg || '操作失败', 'error');
    }
}

// 通用请求方法
function ajaxRequest(url, options) {
    const opts = $.extend({}, defaultOptions, options);
    
    // 如果没有指定错误处理，则使用默认错误处理
    if (!opts.error) {
        opts.error = handleError;
    }
    
    return $.ajax(opts);
}

// GET 请求
function get(url, data, successCallback) {
    const promise = ajaxRequest(url, {
        method: 'GET',
        data: data
    });
    
    if (successCallback) {
        promise.done(function(response) {
            handleResponse(response, successCallback);
        });
    }
    
    return promise;
}

// POST 请求
function post(url, data, successCallback) {
    const promise = ajaxRequest(url, {
        method: 'POST',
        data: JSON.stringify(data)
    });
    
    if (successCallback) {
        promise.done(function(response) {
            handleResponse(response, successCallback);
        });
    }
    
    return promise;
}

// PUT 请求
function put(url, data, successCallback) {
    const promise = ajaxRequest(url, {
        method: 'PUT',
        data: JSON.stringify(data)
    });
    
    if (successCallback) {
        promise.done(function(response) {
            handleResponse(response, successCallback);
        });
    }
    
    return promise;
}

// DELETE 请求
function del(url, successCallback) {
    const promise = ajaxRequest(url, {
        method: 'DELETE'
    });
    
    if (successCallback) {
        promise.done(function(response) {
            handleResponse(response, successCallback);
        });
    }
    
    return promise;
}

// 导出请求方法
window.Http = {
    get: get,
    post: post,
    put: put,
    delete: del,
    handleError: handleError,
    handleResponse: handleResponse
};
