document.addEventListener('DOMContentLoaded', async () => {
  const openOptionsButton = document.getElementById('openOptions');
  const statusMessage = document.getElementById('statusMessage');

  await loadConfig();

  openOptionsButton.addEventListener('click', () => {
    // 打开选项页面
    chrome.runtime.openOptionsPage();
  });

  async function loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getConfig'
      });

      if (response.success && response.config) {
        const isConfigured = response.config.appId && response.config.appSecret && response.config.docToken;
        updateStatus(isConfigured);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  function updateStatus(isConfigured) {
    statusMessage.className = 'status-message ' + (isConfigured ? 'configured' : 'not-configured');
    if (isConfigured) {
      statusMessage.innerHTML = '<p>✅ 配置已完成，可以开始使用收藏功能</p>';
    } else {
      statusMessage.innerHTML = '<p>⚠️ 请先配置飞书应用信息</p>';
    }
  }
});
