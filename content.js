let saveButton = null;
let selectedText = '';
let currentSelection = null;

function createSaveButton() {
  if (saveButton) return saveButton;

  saveButton = document.createElement('div');
  saveButton.id = 'feishu-save-button';
  saveButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3H18C19.1 3 20 3.9 20 5V21L12 17L4 21V5C4 3.9 4.9 3 6 3Z" fill="currentColor"/>
    </svg>
    <span>收藏</span>
  `;
  saveButton.addEventListener('click', handleSave);
  
  document.body.appendChild(saveButton);
  return saveButton;
}

function getSelectionPosition() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  return {
    x: rect.left + window.scrollX + rect.width / 2 - 40,
    y: rect.top + window.scrollY - 45
  };
}

function showSaveButton() {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
  
  if (selectedText.length === 0) {
    hideSaveButton();
    return;
  }

  currentSelection = selection;
  const position = getSelectionPosition();
  if (!position) return;

  const button = createSaveButton();
  button.style.left = position.x + 'px';
  button.style.top = position.y + 'px';
  button.style.display = 'flex';
}

function hideSaveButton() {
  if (saveButton) {
    saveButton.style.display = 'none';
  }
}

function showLoading() {
  if (saveButton) {
    saveButton.classList.add('loading');
    saveButton.innerHTML = `
      <div class="spinner"></div>
      <span>收藏中...</span>
    `;
  }
}

function hideLoading() {
  if (saveButton) {
    saveButton.classList.remove('loading');
    saveButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 3H18C19.1 3 20 3.9 20 5V21L12 17L4 21V5C4 3.9 4.9 3 6 3Z" fill="currentColor"/>
      </svg>
      <span>收藏</span>
    `;
  }
}

function showMessage(type, message, docUrl = '', debugInfo = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `feishu-message ${type}`;
  
  let content = `<p class="message-text">${message}</p>`;
  
  if (debugInfo) {
    // 构建详细的错误信息
    let debugContent = '';
    
    // 添加关键信息
    if (debugInfo.documentId) {
      debugContent += `<div class="debug-section">`;
      debugContent += `<span class="debug-label">Document ID:</span> <span class="debug-value">${escapeHtml(debugInfo.documentId)}</span>`;
      debugContent += `</div>`;
    }
    
    if (debugInfo.parentBlockId) {
      debugContent += `<div class="debug-section">`;
      debugContent += `<span class="debug-label">Block ID:</span> <span class="debug-value">${escapeHtml(debugInfo.parentBlockId)}</span>`;
      debugContent += `</div>`;
    }
    
    // 添加失败的API接口信息
    if (debugInfo.failedApi) {
      debugContent += `<div class="debug-section error-api">`;
      debugContent += `<span class="debug-label">失败的API接口:</span> <span class="debug-value error">${escapeHtml(debugInfo.failedApi)}</span>`;
      debugContent += `</div>`;
    }
    
    // 添加API调用信息
    if (debugInfo.apiCalls && debugInfo.apiCalls.length > 0) {
      debugContent += `<div class="api-calls">`;
      debugInfo.apiCalls.forEach((call, index) => {
        const isFailed = debugInfo.failedApi === call.api;
        debugContent += `<div class="api-call ${isFailed ? 'failed' : ''}">`;
        debugContent += `<div class="api-header">`;
        debugContent += `<span class="api-method">${call.method}</span>`;
        debugContent += `<span class="api-url">${escapeHtml(call.api)}</span>`;
        debugContent += `<span class="api-status ${isFailed ? 'error' : ''}">HTTP ${call.statusCode}</span>`;
        debugContent += `</div>`;
        if (call.request) {
          debugContent += `<div class="api-request">`;
          debugContent += `<div class="api-section-title">请求参数：</div>`;
          debugContent += `<pre class="api-request-content">${escapeHtml(JSON.stringify(call.request, null, 2))}</pre>`;
          debugContent += `</div>`;
        }
        debugContent += `<div class="api-response-section">`;
        debugContent += `<div class="api-section-title">响应数据：</div>`;
        debugContent += `<pre class="api-response">${escapeHtml(JSON.stringify(call.response, null, 2))}</pre>`;
        debugContent += `</div>`;
        debugContent += `</div>`;
      });
      debugContent += `</div>`;
    }
    
    // 添加完整的JSON
    const fullJson = JSON.stringify(debugInfo, null, 2);
    
    // 安全处理 JSON 数据，避免引号导致的语法错误
    const jsonData = JSON.stringify(debugInfo);
    const safeJsonData = jsonData.replace(/"/g, '&quot;');
    
    content += `
      <div class="error-details">
        <div class="debug-info">${debugContent}</div>
        <details class="full-json-section">
          <summary class="full-json-toggle">查看完整JSON</summary>
          <pre class="error-json full-json">${escapeHtml(fullJson)}</pre>
        </details>
        <button class="copy-button" data-json="${safeJsonData}">
          <span class="copy-icon">📋</span>
          <span class="copy-text">复制详细信息</span>
        </button>
      </div>
    `;
  }
  
  if (docUrl) {
    content += `<a href="${docUrl}" target="_blank" class="feishu-doc-link">打开飞书文档</a>`;
  }
  
  messageDiv.innerHTML = content;
  document.body.appendChild(messageDiv);
  
  // 添加复制按钮事件监听器
  const copyButton = messageDiv.querySelector('.copy-button');
  if (copyButton) {
    copyButton.addEventListener('click', () => copyToClipboard(copyButton));
  }
  
  // 不自动关闭错误消息，让用户可以查看和复制
  if (type === 'error') {
    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'message-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
      messageDiv.style.opacity = '0';
      setTimeout(() => messageDiv.remove(), 300);
    };
    messageDiv.appendChild(closeBtn);
  } else {
    // 成功消息3秒后自动关闭
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
  }
}

// 辅助函数：转义HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(button) {
  let text;
  
  // 从 data-json 属性读取 JSON 数据
  const jsonData = button.getAttribute('data-json');
  if (jsonData) {
    try {
      // 先解码 HTML 实体
      const decodedJsonData = jsonData.replace(/&quot;/g, '"');
      const parsedData = JSON.parse(decodedJsonData);
      text = JSON.stringify(parsedData, null, 2);
    } catch (e) {
      console.error('JSON 解析失败:', e);
      // 如果解析失败，从 DOM 读取
      const messageDiv = button.closest('.feishu-message');
      const jsonPre = messageDiv.querySelector('.full-json');
      text = jsonPre ? jsonPre.textContent : jsonData;
    }
  } else {
    // 从 DOM 读取
    const messageDiv = button.closest('.feishu-message');
    const jsonPre = messageDiv.querySelector('.full-json');
    text = jsonPre ? jsonPre.textContent : '';
  }
  
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.querySelector('.copy-text').textContent;
    button.querySelector('.copy-text').textContent = '已复制！';
    button.querySelector('.copy-icon').textContent = '✅';
    button.classList.add('copied');
    setTimeout(() => {
      button.querySelector('.copy-text').textContent = originalText;
      button.querySelector('.copy-icon').textContent = '📋';
      button.classList.remove('copied');
    }, 2500);
  }).catch(err => {
    console.error('复制失败:', err);
    button.querySelector('.copy-text').textContent = '复制失败';
    setTimeout(() => {
      button.querySelector('.copy-text').textContent = '复制详细信息';
    }, 2000);
  });
}

async function handleSave() {
  if (!selectedText) return;
  
  showLoading();
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveToFeishu',
      data: {
        text: selectedText,
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString()
      }
    });
    
    hideLoading();
    
    if (response.success) {
      if (response.isDuplicate) {
        // 显示绿色的重复提示
        showMessage('success', response.message || '该内容已添加过，请勿重复添加', '');
      } else {
        // 显示收藏成功提示
        showMessage('success', '收藏成功！', response.docUrl);
      }
      hideSaveButton();
      window.getSelection().removeAllRanges();
    } else {
      // 检查是否是授权错误
      if (response.debugInfo && response.debugInfo.code === 'AUTH_ERROR') {
        // 自动打开授权页面
        chrome.runtime.sendMessage({
          action: 'openAuthPage'
        });
        showMessage('error', '请先进行飞书授权', '', response.debugInfo);
      } else {
        showMessage('error', `收藏失败：${response.error}`, '', response.debugInfo);
      }
    }
  } catch (error) {
    hideLoading();
    showMessage('error', `收藏失败：${error.message}`, '', error);
  }
}

document.addEventListener('mouseup', () => {
  setTimeout(showSaveButton, 10);
});

document.addEventListener('mousedown', (e) => {
  if (saveButton && !saveButton.contains(e.target)) {
    setTimeout(() => {
      if (!saveButton.matches(':hover')) {
        hideSaveButton();
      }
    }, 100);
  }
});
