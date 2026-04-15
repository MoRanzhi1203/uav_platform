// 通用脚本

// 页面加载完成后执行
$(document).ready(function() {
    // 初始化工具提示
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    
    // 初始化弹出框
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    
    // 侧边栏切换
    $('.navbar-toggler').on('click', function() {
        $('#sidebarMenu').toggleClass('show');
    });
    
    // 表格行悬停效果
    $('.table').on('mouseenter', 'tr', function() {
        $(this).addClass('table-hover');
    }).on('mouseleave', 'tr', function() {
        $(this).removeClass('table-hover');
    });
    
    // 确认删除
    $('.confirm-delete').on('click', function(e) {
        e.preventDefault();
        const url = $(this).attr('href');
        if (confirm('确定要删除吗？')) {
            window.location.href = url;
        }
    });
    
    // 初始化消息容器
    if (!$('#message-container').length) {
        $('body').append('<div id="message-container" class="fixed-top end-0 top-0 m-3 z-50"></div>');
    }
});

// ==========================================
// 全局 Bootstrap 模态框封装 (NiceAdmin 风格)
// ==========================================

/**
 * 替代原生 alert
 * @param {string} message 提示信息
 * @param {string} title 标题，默认为"提示"
 * @param {string} type 类型: 'info', 'success', 'warning', 'danger'
 */
window.showAlert = function(message, title = '提示', type = 'info') {
    const modalEl = document.getElementById('globalAlertModal');
    if (!modalEl) {
        alert(message);
        return;
    }
    
    document.getElementById('globalAlertTitle').textContent = title;
    document.getElementById('globalAlertMessage').innerHTML = message.replace(/\n/g, '<br>');
    
    // 设置图标和颜色
    const iconContainer = document.getElementById('globalAlertIconContainer');
    const iconEl = document.getElementById('globalAlertIcon');
    const okBtn = document.getElementById('globalAlertOkBtn');
    
    const typeConfig = {
        info: { icon: 'bi-info-circle', color: 'text-primary', btn: 'btn-primary' },
        success: { icon: 'bi-check-circle', color: 'text-success', btn: 'btn-success' },
        warning: { icon: 'bi-exclamation-triangle', color: 'text-warning', btn: 'btn-warning' },
        danger: { icon: 'bi-exclamation-octagon', color: 'text-danger', btn: 'btn-danger' }
    };
    
    const config = typeConfig[type] || typeConfig.info;
    
    if (iconContainer && iconEl) {
        iconContainer.classList.remove('d-none');
        iconEl.className = 'bi ' + config.icon + ' ' + config.color;
    }
    
    if (okBtn) {
        okBtn.className = 'btn px-4 ' + config.btn;
    }
    
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

/**
 * 替代原生 confirm
 * @param {string} message 提示信息
 * @param {function} onConfirm 点击确定的回调
 * @param {function} onCancel 点击取消的回调 (可选)
 * @param {string} title 标题，默认为"确认操作"
 * @param {string} type 类型: 'info', 'warning', 'danger'
 */
window.showConfirm = function(message, onConfirm, onCancel = null, title = '确认操作', type = 'info') {
    const modalEl = document.getElementById('globalConfirmModal');
    if (!modalEl) {
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
        return;
    }

    document.getElementById('globalConfirmTitle').textContent = title;
    document.getElementById('globalConfirmMessage').innerHTML = message.replace(/\n/g, '<br>');

    // 设置图标和颜色
    const iconContainer = document.getElementById('globalConfirmIconContainer');
    const iconEl = document.getElementById('globalConfirmIcon');
    const okBtn = document.getElementById('globalConfirmOkBtn');
    
    const typeConfig = {
        info: { icon: 'bi-question-circle', color: 'text-primary', btn: 'btn-primary' },
        warning: { icon: 'bi-exclamation-triangle', color: 'text-warning', btn: 'btn-warning' },
        danger: { icon: 'bi-exclamation-octagon', color: 'text-danger', btn: 'btn-danger' }
    };
    
    const config = typeConfig[type] || typeConfig.info;
    
    if (iconContainer && iconEl) {
        iconContainer.classList.remove('d-none');
        iconEl.className = 'bi ' + config.icon + ' ' + config.color;
    }
    
    if (okBtn) {
        okBtn.className = 'btn px-3 ' + config.btn;
    }

    const cancelBtn = document.getElementById('globalConfirmCancelBtn');
    
    // 清理旧事件绑定
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const modal = new bootstrap.Modal(modalEl);

    newOkBtn.addEventListener('click', () => {
        modal.hide();
        if (onConfirm) onConfirm();
    });

    newCancelBtn.addEventListener('click', () => {
        modal.hide(); // 明确关闭
        if (onCancel) onCancel();
    });

    // 监听关闭事件（点 X 或遮罩层关闭），视作取消
    modalEl.addEventListener('hidden.bs.modal', function handler() {
        if (onCancel) onCancel();
        modalEl.removeEventListener('hidden.bs.modal', handler);
        // 重置图标容器
        if (iconContainer) iconContainer.classList.add('d-none');
    }, { once: true });

    modal.show();
};

/**
 * 替代原生 prompt
 * @param {string} message 提示信息
 * @param {string} defaultValue 默认值
 * @param {function} onConfirm 确定回调，参数为输入的值。如果点击取消，则传 null。
 * @param {string} title 标题，默认为"请输入"
 */
window.showPrompt = function(message, defaultValue = '', onConfirm, title = '请输入') {
    const modalEl = document.getElementById('globalPromptModal');
    if (!modalEl) {
        const val = prompt(message, defaultValue);
        if (onConfirm) onConfirm(val);
        return;
    }

    document.getElementById('globalPromptTitle').textContent = title;
    document.getElementById('globalPromptMessage').textContent = message;
    const inputEl = document.getElementById('globalPromptInput');
    inputEl.value = defaultValue;

    const okBtn = document.getElementById('globalPromptOkBtn');
    const cancelBtn = document.getElementById('globalPromptCancelBtn');
    
    // 清理旧事件绑定
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const modal = new bootstrap.Modal(modalEl);

    // 确定
    newOkBtn.addEventListener('click', () => {
        const val = inputEl.value;
        modal.hide();
        if (onConfirm) onConfirm(val);
    });

    // 回车确认
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            newOkBtn.click();
        }
    });

    // 模态框显示后自动聚焦
    modalEl.addEventListener('shown.bs.modal', function focusHandler() {
        inputEl.focus();
        inputEl.select();
        modalEl.removeEventListener('shown.bs.modal', focusHandler);
    });

    // 监听关闭事件处理取消
    let isConfirmed = false;
    newOkBtn.addEventListener('click', () => { isConfirmed = true; });
    
    modalEl.addEventListener('hidden.bs.modal', function handler() {
        if (!isConfirmed && onConfirm) onConfirm(null);
        modalEl.removeEventListener('hidden.bs.modal', handler);
    }, { once: true });

    modal.show();
};

// 显示消息提示
function showMessage(message, type = 'success', duration = 3000) {
    const alertClasses = {
        success: 'alert-success',
        error: 'alert-danger',
        warning: 'alert-warning',
        info: 'alert-info'
    };
    
    const alertClass = alertClasses[type] || 'alert-success';
    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert" style="max-width: 400px; margin-left: auto; margin-right: 2rem;">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    $('#message-container').html(alertHtml);
    
    if (duration > 0) {
        setTimeout(() => {
            $('.alert').alert('close');
        }, duration);
    }
}

// 格式化日期时间
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 格式化数字
function formatNumber(num) {
    return num.toLocaleString('zh-CN');
}

// 格式化百分比
function formatPercentage(num, decimals = 2) {
    return (num * 100).toFixed(decimals) + '%';
}

// 显示加载动画
function showLoading(target = 'body') {
    const loadingHtml = `
        <div class="loading-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255, 255, 255, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div class="loading-dark"></div>
        </div>
    `;
    
    const $target = $(target);
    $target.css('position', 'relative');
    $target.append(loadingHtml);
}

// 隐藏加载动画
function hideLoading(target = 'body') {
    $(target).find('.loading-overlay').remove();
}

// 表单验证
function validateForm(formSelector) {
    const $form = $(formSelector);
    const $inputs = $form.find('input[required], select[required], textarea[required]');
    let isValid = true;
    
    $inputs.each(function() {
        if (!$(this).val()) {
            $(this).addClass('is-invalid');
            isValid = false;
        } else {
            $(this).removeClass('is-invalid');
        }
    });
    
    return isValid;
}

// 表格排序
function setupTableSort(tableSelector) {
    $(tableSelector).on('click', 'th[data-sort]', function() {
        const $th = $(this);
        const sortField = $th.data('sort');
        const currentOrder = $th.data('order') || 'asc';
        const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
        
        // 更新排序状态
        $th.data('order', newOrder);
        $th.find('i').remove();
        $th.append(`<i class="bi bi-arrow-${newOrder === 'asc' ? 'up' : 'down'}-sm ml-1"></i>`);
        
        // 触发排序事件
        $th.trigger('table.sort', { field: sortField, order: newOrder });
    });
}

// 模态框操作
function showModal(modalId) {
    $(`#${modalId}`).modal('show');
}

function hideModal(modalId) {
    $(`#${modalId}`).modal('hide');
}

// 导出通用方法
window.Common = {
    showMessage: showMessage,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    formatNumber: formatNumber,
    formatPercentage: formatPercentage,
    showLoading: showLoading,
    hideLoading: hideLoading,
    validateForm: validateForm,
    setupTableSort: setupTableSort,
    showModal: showModal,
    hideModal: hideModal
};

// ==========================================
// 全局复制策略控制 (Global Copy Policy)
// ==========================================
(function() {
    // 1. 页面级白名单配置 (按路径或路由名匹配)
    // 支持字符串精确匹配或正则表达式
    const copyWhiteList = [
        // 示例：允许复制的页面路径
        // '/help/',
        // '/docs/',
        // /^\/export\/.*$/
    ];

    // 判断当前页面是否在白名单中
    function isPageInWhiteList() {
        const currentPath = window.location.pathname;
        
        // 方式1：检查 meta 标签 (推荐：在特定页面的模板中加入 <meta name="allow-copy" content="true">)
        const metaAllow = document.querySelector('meta[name="allow-copy"]');
        if (metaAllow && metaAllow.getAttribute('content') === 'true') {
            return true;
        }

        // 方式2：检查全局变量配置
        if (window.ALLOW_COPY === true) {
            return true;
        }

        // 方式3：检查路由/路径白名单
        for (let rule of copyWhiteList) {
            if (typeof rule === 'string' && currentPath.includes(rule)) {
                return true;
            } else if (rule instanceof RegExp && rule.test(currentPath)) {
                return true;
            }
        }
        
        return false;
    }

    // 判断事件目标是否在允许复制的容器内（或豁免的输入组件）
    function isTargetInEnabledContainer(target) {
        if (!target) return false;
        
        // 豁免输入框、文本域
        const tagName = target.tagName ? target.tagName.toLowerCase() : '';
        const isInput = tagName === 'input' || tagName === 'textarea';
        
        // 豁免可编辑区域 (contenteditable)
        const isContentEditable = target.isContentEditable;
        
        // 豁免特殊编辑器和地图容器（Monaco, CodeMirror, TinyMCE, Quill, 百度/高德/Cesium等地图容器）
        const closestEditor = target.closest && target.closest('.monaco-editor, .CodeMirror, .tox-tinymce, .ql-editor, .mapboxgl-canvas-container, .cesium-viewer');
        
        // 豁免局部白名单类名和属性
        const isLocalEnabled = target.closest && target.closest('.copy-enabled, [data-allow-copy="true"]');
        
        return isInput || isContentEditable || !!closestEditor || !!isLocalEnabled;
    }

    // 初始化复制策略
    function initCopyPolicy() {
        if (isPageInWhiteList()) {
            document.body.classList.add('copy-enabled-page');
            document.body.classList.remove('copy-disabled');
            return;
        }

        // 默认禁用页面整体的复制
        document.body.classList.add('copy-disabled');

        // 拦截复制快捷键 (Ctrl+C / Cmd+C / Ctrl+X / Cmd+X)
        document.addEventListener('keydown', function(e) {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            if (isCtrlOrCmd && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
                if (!isTargetInEnabledContainer(e.target)) {
                    e.preventDefault();
                    // 可选提示
                    // console.warn('此页面默认禁用复制功能。');
                }
            }
        });

        // 拦截 copy 和 cut 事件
        document.addEventListener('copy', function(e) {
            if (!isTargetInEnabledContainer(e.target)) {
                e.preventDefault();
            }
        });
        
        document.addEventListener('cut', function(e) {
            if (!isTargetInEnabledContainer(e.target)) {
                e.preventDefault();
            }
        });
    }

    // 在 DOM 加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCopyPolicy);
    } else {
        initCopyPolicy();
    }
})();

