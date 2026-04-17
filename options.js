document.addEventListener('DOMContentLoaded', async () => {
  const appIdInput = document.getElementById('appId');
  const appSecretInput = document.getElementById('appSecret');
  const docUrlInput = document.getElementById('docUrl');
  const redirectUrlInput = document.getElementById('redirectUrl');
  const copyRedirectUrlButton = document.getElementById('copyRedirectUrl');
  const saveButton = document.getElementById('saveConfig');
  const statusMessage = document.getElementById('statusMessage');

  await loadConfig();
  updateRedirectUrl();

  saveButton.addEventListener('click', async () => {
    const docUrl = docUrlInput.value.trim();
    const docToken = extractDocTokenFromUrl(docUrl);
    
    if (!docToken) {
      showMessage('请输入有效的飞书知识库文档URL', 'error');
      return;
    }

    const config = {
      appId: appIdInput.value.trim(),
      appSecret: appSecretInput.value.trim(),
      docToken: docToken
    };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'setConfig',
        config: config
      });

      if (response.success) {
        updateStatus(false); // 配置保存成功，但还需要授权
        showMessage('配置保存成功，请进行飞书授权', 'success');
        document.getElementById('authorizeFeishu').style.display = 'block';
      }
    } catch (error) {
      showMessage('配置保存失败：' + error.message, 'error');
    }
  });

  document.getElementById('authorizeFeishu').addEventListener('click', () => {
    // 调用后台脚本打开授权页面
    chrome.runtime.sendMessage({
      action: 'openAuthPage'
    }, (response) => {
      if (response.success) {
        showMessage('授权页面已打开', 'success');
      } else {
        showMessage('打开授权页面失败：' + response.error, 'error');
      }
    });
  });

  copyRedirectUrlButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(redirectUrlInput.value);
      copyRedirectUrlButton.textContent = '已复制！';
      copyRedirectUrlButton.classList.add('copied');
      setTimeout(() => {
        copyRedirectUrlButton.textContent = '复制';
        copyRedirectUrlButton.classList.remove('copied');
      }, 2000);
      showMessage('重定向URL已复制到剪贴板', 'success');
    } catch (error) {
      showMessage('复制失败：' + error.message, 'error');
    }
  });

  async function loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getConfig'
      });

      if (response.success && response.config) {
        if (response.config.appId) appIdInput.value = response.config.appId;
        if (response.config.appSecret) appSecretInput.value = response.config.appSecret;
        if (response.config.docToken) docUrlInput.value = `https://my.feishu.cn/wiki/${response.config.docToken}`;
        
        const isConfigured = response.config.appId && response.config.appSecret && response.config.docToken;
        updateStatus(isConfigured);
        
        // 检查是否需要显示授权按钮
        if (isConfigured && !response.config.isAuthorized) {
          document.getElementById('authorizeFeishu').style.display = 'block';
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  function extractDocTokenFromUrl(url) {
    // 正则表达式提取文档Token
    const regex = /wiki\/([a-zA-Z0-9]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  function updateRedirectUrl() {
    // 使用chrome.identity.getRedirectURL生成符合OAuth 2.0要求的重定向URL
    const redirectUrl = chrome.identity.getRedirectURL('feishu-auth');
    redirectUrlInput.value = redirectUrl;
  }

  function updateStatus(isConfigured) {
    // 检查是否已授权
    chrome.runtime.sendMessage({
      action: 'getConfig'
    }, (response) => {
      if (response.success && response.config) {
        const isAuthorized = response.config.isAuthorized;
        
        if (isConfigured && isAuthorized) {
          statusMessage.className = 'status-message configured';
          statusMessage.innerHTML = '<p>✅ 配置已完成并授权成功，可以开始使用收藏功能</p>';
          document.getElementById('authorizeFeishu').style.display = 'none';
        } else if (isConfigured) {
          statusMessage.className = 'status-message not-configured';
          statusMessage.innerHTML = '<p>⚠️ 配置已保存，请进行飞书授权</p>';
          document.getElementById('authorizeFeishu').style.display = 'block';
        } else {
          statusMessage.className = 'status-message not-configured';
          statusMessage.innerHTML = '<p>⚠️ 请先配置飞书应用信息</p>';
          document.getElementById('authorizeFeishu').style.display = 'none';
        }
      }
    });
  }

  function showMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
  }
});
