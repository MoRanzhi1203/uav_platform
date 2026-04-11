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
