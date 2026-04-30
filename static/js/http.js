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
    const responseText = xhr?.responseText || '';
    const contentType = xhr?.getResponseHeader ? xhr.getResponseHeader('Content-Type') : '';
    console.error('Ajax error:', {
        url: xhr?.responseURL || '',
        status: xhr?.status,
        statusText: xhr?.statusText,
        error: error,
        contentType: contentType,
        responsePreview: responseText.slice(0, 300)
    });

    if (xhr.status === 401) {
        Common.showMessage('登录状态已失效，请重新登录。', 'error');
    } else if (xhr.status === 403) {
        Common.showMessage('权限不足', 'error');
    } else if (xhr.status === 404) {
        Common.showMessage('资源不存在', 'error');
    } else if (xhr.status === 500) {
        Common.showMessage('服务器内部错误', 'error');
    } else {
        Common.showMessage(xhr?.responseJSON?.message || xhr?.responseJSON?.msg || '操作失败，请重试', 'error');
    }
}

// 响应标准化处理
function normalizeApiResponse(response) {
    // 如果 response 本身就是数组
    if (Array.isArray(response)) {
        return { success: true, message: 'ok', data: response };
    }

    // 处理标准结构 { success, data, message }
    let success = response?.success;
    let data = response?.data;
    let message = response?.message || response?.msg || 'ok';

    // 兼容 code: 0 或 code: 200
    if (success === undefined) {
        if (response?.code === 0 || response?.code === 200) {
            success = true;
        } else if (response?.code !== undefined) {
            success = false;
        }
    }

    // 兼容顶层分页结构 { results, count }
    if (data === undefined) {
        if (response?.results && response?.count !== undefined) {
            data = response;
            success = true;
        } else {
            data = response;
            if (success === undefined) success = true;
        }
    }

    return {
        success: !!success,
        message: message,
        data: data
    };
}

function renderEmptyState(container, message) {
    if (!container) {
        return;
    }
    container.innerHTML = `<div class="text-center text-muted py-4">${message || '暂无数据'}</div>`;
}

function showFriendlyError(message, detail) {
    if (detail) {
        console.error(message, detail);
    }
    Common.showMessage(message || '请求失败', 'error');
}

// 响应处理函数
function handleResponse(response, successCallback) {
    const normalized = normalizeApiResponse(response);
    if (normalized.success) {
        if (successCallback) {
            successCallback(normalized.data);
        }
    } else {
        Common.showMessage(normalized.message || '操作失败', 'error');
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

// 统一 JSON 请求封装 (fetch 版)
async function safeFetchJson(url, options = {}) {
    const defaultHeaders = {
        'X-CSRFToken': getCsrfToken(),
        'Content-Type': 'application/json'
    };

    const config = {
        method: options.method || 'GET',
        headers: Object.assign({}, defaultHeaders, options.headers || {}),
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const res = await fetch(url, config);
        const contentType = res.headers.get('content-type');
        
        if (!res.ok) {
            let errorDetail = '';
            if (contentType && contentType.includes('application/json')) {
                const errData = await res.json();
                errorDetail = errData.msg || errData.message || res.statusText;
            } else {
                const text = await res.text();
                console.error(`API Error Response (${res.status}):`, text.substring(0, 300));
                errorDetail = `HTTP ${res.status}`;
            }
            throw new Error(errorDetail);
        }

        if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            return normalizeApiResponse(data);
        } else {
            const text = await res.text();
            console.warn('API returned non-JSON content:', text.substring(0, 300));
            return {
                success: true,
                message: 'ok',
                data: text
            };
        }
    } catch (error) {
        console.error(`Fetch error [${url}]:`, error);
        return {
            success: false,
            message: error.message || '网络请求失败',
            data: null
        };
    }
}

// 导出请求方法
window.Http = {
    get: get,
    post: post,
    put: put,
    delete: del,
    handleError: handleError,
    handleResponse: handleResponse,
    normalizeApiResponse: normalizeApiResponse,
    safeFetchJson: safeFetchJson,
    renderEmptyState: renderEmptyState,
    showFriendlyError: showFriendlyError
};
