/**
 * 飞书文档收藏助手 - 后台服务
 * 负责处理飞书API调用和授权流程
 */

// 飞书API基础URL
const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

/**
 * 飞书服务类
 * 封装飞书API调用和相关逻辑
 */
class FeishuService {
  /**
   * 构造函数
   * 初始化服务
   */
  constructor() {
    this.init();
  }

  /**
   * 初始化服务
   * 加载配置信息
   */
  async init() {
    const config = await this.getConfig();
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.docToken = config.docToken;
  }

  /**
   * 获取配置信息
   * 从浏览器存储中读取配置
   * @returns {Promise<Object>} 配置对象
   */
  async getConfig() {
    const result = await chrome.storage.local.get([
      'appId', 'appSecret', 'docToken', 
      'accessToken', 'refreshToken', 'tokenExpireTime',
      'userAccessToken', 'userRefreshToken', 'userTokenExpireTime', 'isAuthorized'
    ]);
    return result;
  }

  /**
   * 保存配置信息
   * 将配置写入浏览器存储
   * @param {Object} config 配置对象
   */
  async setConfig(config) {
    await chrome.storage.local.set(config);
    if (config.appId) this.appId = config.appId;
    if (config.appSecret) this.appSecret = config.appSecret;
    if (config.docToken) this.docToken = config.docToken;
  }

  /**
   * 获取用户访问令牌
   * 自动处理令牌过期和刷新
   * @returns {Promise<string>} 用户访问令牌
   */
  async getUserAccessToken() {
    const config = await this.getConfig();
    const now = Date.now();

    // 检查令牌是否有效
    if (config.userAccessToken && config.userTokenExpireTime && now < config.userTokenExpireTime) {
      return config.userAccessToken;
    }

    // 刷新令牌
    if (config.userRefreshToken) {
      try {
        const response = await fetch(FEISHU_API_BASE + '/authen/v1/refresh_access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            app_id: this.appId,
            app_secret: this.appSecret,
            refresh_token: config.userRefreshToken,
            grant_type: 'refresh_token'
          })
        });

        const data = await response.json();
        if (data.code !== 0) {
          throw new Error(`刷新用户访问令牌失败: ${data.msg} (code: ${data.code})`);
        }

        // 保存新令牌
        const expireTime = now + (data.data.expire - 300) * 1000;
        await this.setConfig({
          userAccessToken: data.data.access_token,
          userRefreshToken: data.data.refresh_token,
          userTokenExpireTime: expireTime
        });

        return data.data.access_token;
      } catch (error) {
        console.error('刷新用户访问令牌错误:', error);
        throw error;
      }
    }

    throw new Error('用户未授权或令牌已过期');
  }

  /**
   * 获取飞书租户访问令牌
   * 自动处理令牌过期和刷新
   * @returns {Promise<string>} 访问令牌
   */
  async getTenantAccessToken() {
    const config = await this.getConfig();
    const now = Date.now();

    // 检查令牌是否有效
    if (config.accessToken && config.tokenExpireTime && now < config.tokenExpireTime) {
      return config.accessToken;
    }

    try {
      // 调用获取租户访问令牌接口
      const response = await fetch(FEISHU_API_BASE + '/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret
        })
      });

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(`获取tenant_access_token失败: ${data.msg} (code: ${data.code})`);
      }

      // 计算过期时间（提前5分钟刷新）
      const expireTime = now + (data.expire - 300) * 1000;
      await this.setConfig({
        accessToken: data.tenant_access_token,
        tokenExpireTime: expireTime
      });

      return data.tenant_access_token;
    } catch (error) {
      console.error('获取tenant_access_token错误:', error);
      throw error;
    }
  }

  /**
   * 追加内容到飞书文档
   * 实现完整的收藏流程
   * @param {string} text 选中的文本内容
   * @param {string} url 原文所在网页URL
   * @param {string} timestamp 收藏时间戳
   * @returns {Promise<Object>} 收藏结果
   */
  async appendToDocument(text, url, title, timestamp) {
    // 初始化调试信息
    const debugInfo = {
      timestamp: new Date().toISOString(),
      nodeToken: this.docToken,
      documentId: null,
      parentBlockId: null,
      apiCalls: []
    };

    // 检查配置
    if (!this.docToken) {
      throw {
        message: '请先在插件设置中配置飞书文档Token',
        code: 'CONFIG_ERROR',
        debugInfo: {
          ...debugInfo,
          message: '缺少配置信息',
          required_fields: ['docToken', 'appId', 'appSecret']
        }
      };
    }

    // 检查是否已授权
    const config = await this.getConfig();
    if (!config.isAuthorized) {
      throw {
        message: '请先进行飞书授权',
        code: 'AUTH_ERROR',
        debugInfo: {
          ...debugInfo,
          message: '用户未授权，无法访问飞书文档'
        }
      };
    }

    // 获取访问令牌（优先使用用户访问令牌）
    let accessToken;
    try {
      try {
        accessToken = await this.getUserAccessToken();
      } catch (error) {
        // 如果用户令牌获取失败，回退到租户令牌
        accessToken = await this.getTenantAccessToken();
      }
    } catch (error) {
      // 访问令牌获取失败
      throw {
        message: `获取访问令牌失败: ${error.message}`,
        code: 'TOKEN_ERROR',
        debugInfo: {
          ...debugInfo,
          message: '无法获取访问令牌，请检查配置和网络连接',
          tokenError: error.message
        }
      };
    }
    const date = new Date(timestamp);
    const formattedTime = date.toLocaleString('zh-CN');

    try {
      // 步骤1：从URL中提取node_token
      const nodeToken = this.docToken;
      
      // 步骤2：调用获取知识空间节点信息接口，获取document_id
      const nodeInfoUrl = String(FEISHU_API_BASE) + '/wiki/v2/spaces/get_node';
      const nodeInfoParams = new URLSearchParams({
        token: String(nodeToken)
      });
      const fullNodeInfoUrl = nodeInfoUrl + '?' + nodeInfoParams.toString();
      const nodeInfoRequest = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8'
        }
      };
      
      // 记录API调用开始
      debugInfo.apiCalls.push({
        api: fullNodeInfoUrl.toString(),
        method: 'GET',
        request: {
          headers: {
            'Authorization': 'Bearer [REDACTED]',
            'Content-Type': 'application/json; charset=utf-8'
          },
          params: {
            token: String(nodeToken)
          }
        },
        startTime: new Date().toISOString()
      });
      
      let nodeInfoData;
      try {
        const nodeInfoResponse = await fetch(fullNodeInfoUrl, nodeInfoRequest);
        
        nodeInfoData = await nodeInfoResponse.json();
        
        // 更新API调用记录，添加响应信息
        const lastCall = debugInfo.apiCalls[debugInfo.apiCalls.length - 1];
        lastCall.statusCode = nodeInfoResponse.status;
        lastCall.response = nodeInfoData;
        lastCall.endTime = new Date().toISOString();
      } catch (fetchError) {
        // 网络错误处理
        const lastCall = debugInfo.apiCalls[debugInfo.apiCalls.length - 1];
        lastCall.error = fetchError.message;
        lastCall.statusCode = 'NETWORK_ERROR';
        lastCall.endTime = new Date().toISOString();
        
        throw {
          message: `网络错误: ${fetchError.message}`,
          code: 'NETWORK_ERROR',
          debugInfo: {
            ...debugInfo,
            failedApi: fullNodeInfoUrl
          }
        };
      }
      
      if (nodeInfoData.code !== 0) {
        throw {
          message: `获取节点信息失败 [${fullNodeInfoUrl}]: ${nodeInfoData.msg}`,
          code: nodeInfoData.code,
          debugInfo: {
            ...debugInfo,
            failedApi: fullNodeInfoUrl
          }
        };
      }
      
      const documentId = nodeInfoData.data?.node?.obj_token;
      debugInfo.documentId = documentId;
      
      if (!documentId) {
        throw {
          message: `获取document_id失败 [${fullNodeInfoUrl}]`,
          code: 'DOCUMENT_ID_ERROR',
          debugInfo: {
            ...debugInfo,
            message: 'obj_token字段缺失，响应格式可能不正确',
            responseData: nodeInfoData,
            failedApi: fullNodeInfoUrl
          }
        };
      }
      
      // 步骤3：调用获取文档所有块接口，获取最后一个block_id
      const blocksUrl = String(FEISHU_API_BASE) + '/docx/v1/documents/' + String(documentId) + '/blocks';
      const blocksRequest = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };
      
      // 记录API调用开始
      const blocksCallStartTime = new Date().toISOString();
      let blocksResponse, blocksData;
      try {
        blocksResponse = await fetch(blocksUrl, blocksRequest);
        blocksData = await blocksResponse.json();
        
        debugInfo.apiCalls.push({
          api: blocksUrl.toString(),
          method: 'GET',
          statusCode: blocksResponse.status,
          request: {
            headers: {
              'Authorization': 'Bearer [REDACTED]',
              'Content-Type': 'application/json'
            }
          },
          response: blocksData,
          startTime: blocksCallStartTime,
          endTime: new Date().toISOString()
        });
      } catch (fetchError) {
        debugInfo.apiCalls.push({
          api: blocksUrl.toString(),
          method: 'GET',
          request: {
            headers: {
              'Authorization': 'Bearer [REDACTED]',
              'Content-Type': 'application/json'
            }
          },
          error: fetchError.message,
          statusCode: 'NETWORK_ERROR',
          startTime: blocksCallStartTime,
          endTime: new Date().toISOString()
        });
        
        throw {
          message: `网络错误: ${fetchError.message}`,
          code: 'NETWORK_ERROR',
          debugInfo: {
            ...debugInfo,
            failedApi: blocksUrl.toString()
          }
        };
      }
      
      if (blocksData.code !== 0) {
        throw {
          message: `获取文档块失败 [${blocksUrl}]: ${blocksData.msg}`,
          code: blocksData.code,
          debugInfo: {
            ...debugInfo,
            failedApi: blocksUrl.toString()
          }
        };
      }
      
      // 按照官方文档要求，获取最后一个块的block_id
      let blocks = [];
      
      // 检查响应数据结构 - 按照官方文档，块数据在data.items中
      if (blocksData.data && Array.isArray(blocksData.data.items)) {
        blocks = blocksData.data.items;
      } else if (blocksData.data && Array.isArray(blocksData.data.blocks)) {
        // 兼容旧版接口
        blocks = blocksData.data.blocks;
      } else if (blocksData.data && typeof blocksData.data === 'object') {
        // 尝试获取其他可能的块数据结构
        for (const key in blocksData.data) {
          if (Array.isArray(blocksData.data[key])) {
            blocks = blocksData.data[key];
            break;
          }
        }
      }
      
      // 记录块数据信息
      debugInfo.blocksInfo = {
        totalBlocks: blocks.length,
        firstBlock: blocks.length > 0 ? { block_id: blocks[0].block_id, type: blocks[0].block_type } : null,
        lastBlock: blocks.length > 0 ? { block_id: blocks[blocks.length - 1].block_id, type: blocks[blocks.length - 1].block_type } : null
      };
      
      // 查找是否存在相同标题的H1区块
      let matchingH1BlockId = null;
      let parentBlockId = '';
      
      // 遍历所有块，查找标题1 Block（block_type为3）
      for (const block of blocks) {
        if (block.block_type === 3) {
          // 检查是否有heading1字段且包含elements
          if (block.heading1 && block.heading1.elements && block.heading1.elements.length > 0) {
            const textRun = block.heading1.elements[0].text_run;
            if (textRun && textRun.content) {
              const h1Content = textRun.content || '';
              if (h1Content === (title || '无标题')) {
                matchingH1BlockId = block.block_id;
                break;
              }
            }
          }
        }
      }
      
      if (matchingH1BlockId) {
        // 找到匹配的H1标题区块，使用它作为父块
        parentBlockId = matchingH1BlockId;
        debugInfo.matchingH1BlockId = matchingH1BlockId;
        debugInfo.titleConflict = true;
      } else {
        // 未找到匹配的H1标题区块，首次收藏
        // 按照要求，使用document_id作为block_id
        parentBlockId = documentId;
        debugInfo.titleConflict = false;
      }
      
      // 记录最终使用的block_id
      debugInfo.finalBlockId = parentBlockId;
      
      debugInfo.parentBlockId = parentBlockId;
      
      // 检查是否已经存在相同的内容（文本、标题、链接三个都完全一致）
      let isDuplicate = false;
      let foundTitle = false;
      let foundUrl = false;
      let foundText = false;
      
      for (const block of blocks) {
        if (block.block_type === 3) {
          // 检查标题
          if (block.heading1 && block.heading1.elements && block.heading1.elements.length > 0) {
            const h1Content = block.heading1.elements[0].text_run?.content || '';
            if (h1Content === (title || '无标题')) {
              foundTitle = true;
            }
          }
        } else if (block.block_type === 2) {
          // 检查链接和文本
          if (block.text && block.text.elements && block.text.elements.length > 0) {
            const blockContent = block.text.elements[0].text_run?.content || '';
            if (blockContent === url) {
              foundUrl = true;
            } else if (blockContent === text) {
              foundText = true;
            }
          }
        }
      }
      
      // 只有当标题、链接、文本都找到时，才认为是重复
      isDuplicate = foundTitle && foundUrl && foundText;
      
      if (isDuplicate) {
        // 返回成功消息，而不是错误
        return {
          success: true,
          message: '该内容已添加过，请勿重复添加',
          isDuplicate: true
        };
      }
      
      // 步骤4：调用创建块接口，添加收藏信息
      if (!debugInfo.titleConflict) {
        // 首次收藏，标题在文档中没有出现过
        // 首先使用document_id作为block_id，添加标题和链接
        const createTitleUrl = String(FEISHU_API_BASE) + '/docx/v1/documents/' + String(documentId) + '/blocks/' + String(documentId) + '/children?document_revision_id=-1';
        
        const createTitleBody = {
          "index": 0,
          "children": [
            {
              "block_type": 3, // 标题1 Block
              "heading1": {
                "elements": [
                  {
                    "text_run": {
                      "content": title || '无标题',
                      "text_element_style": {
                        "bold": true
                      }
                    }
                  }
                ],
                "style": {
                  "align": 1,
                  "folded": false
                }
              }
            },
            {
              "block_type": 2,
              "text": {
                "elements": [
                  {
                    "text_run": {
                      "content": url,
                      "text_element_style": {}
                    }
                  }
                ],
                "style": {}
              }
            }
          ]
        };
        
        const createTitleRequest = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(createTitleBody)
        };
        
        // 记录API调用开始
        const createTitleCallStartTime = new Date().toISOString();
        let createTitleResponse, createTitleData;
        try {
          createTitleResponse = await fetch(createTitleUrl, createTitleRequest);
          createTitleData = await createTitleResponse.json();
          
          debugInfo.apiCalls.push({
            api: createTitleUrl.toString(),
            method: 'POST',
            statusCode: createTitleResponse.status,
            request: {
              headers: {
                'Authorization': 'Bearer [REDACTED]',
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: createTitleBody
            },
            response: createTitleData,
            startTime: createTitleCallStartTime,
            endTime: new Date().toISOString()
          });
        } catch (fetchError) {
          debugInfo.apiCalls.push({
            api: createTitleUrl.toString(),
            method: 'POST',
            request: {
              headers: {
                'Authorization': 'Bearer [REDACTED]',
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: createTitleBody
            },
            error: fetchError.message,
            statusCode: 'NETWORK_ERROR',
            startTime: createTitleCallStartTime,
            endTime: new Date().toISOString()
          });
          
          throw {
            message: `网络错误: ${fetchError.message}`,
            code: 'NETWORK_ERROR',
            debugInfo: {
              ...debugInfo,
              failedApi: createTitleUrl.toString()
            }
          };
        }
        
        if (createTitleData.code !== 0) {
          throw {
            message: `创建标题失败 [${createTitleUrl}]: ${createTitleData.msg}`,
            code: createTitleData.code,
            debugInfo: {
              ...debugInfo,
              failedApi: createTitleUrl.toString()
            }
          };
        }
        
        // 重新获取文档块，找到新创建的标题的block_id
        const refreshBlocksUrl = String(FEISHU_API_BASE) + '/docx/v1/documents/' + String(documentId) + '/blocks';
        const refreshBlocksRequest = {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        };
        
        const refreshBlocksResponse = await fetch(refreshBlocksUrl, refreshBlocksRequest);
        const refreshBlocksData = await refreshBlocksResponse.json();
        
        if (refreshBlocksData.code !== 0) {
          throw {
            message: `获取文档块失败 [${refreshBlocksUrl}]: ${refreshBlocksData.msg}`,
            code: refreshBlocksData.code,
            debugInfo: {
              ...debugInfo,
              failedApi: refreshBlocksUrl.toString()
            }
          };
        }
        
        // 查找新创建的标题的block_id
        let titleBlockId = null;
        const refreshBlocks = refreshBlocksData.data?.items || [];
        for (const block of refreshBlocks) {
          if (block.block_type === 3) {
            if (block.heading1 && block.heading1.elements && block.heading1.elements.length > 0) {
              const h1Content = block.heading1.elements[0].text_run?.content || '';
              if (h1Content === (title || '无标题')) {
                titleBlockId = block.block_id;
                break;
              }
            }
          }
        }
        
        if (!titleBlockId) {
          throw {
            message: '无法找到新创建的标题区块',
            code: 'TITLE_BLOCK_NOT_FOUND',
            debugInfo: {
              ...debugInfo,
              message: '无法找到新创建的标题区块'
            }
          };
        }
        
        // 使用标题的block_id作为父块，添加时间和内容
        const createContentUrl = String(FEISHU_API_BASE) + '/docx/v1/documents/' + String(documentId) + '/blocks/' + String(titleBlockId) + '/children?document_revision_id=-1';
        const createContentBody = {
          "index": 0,
          "children": [
            {
              "block_type": 2,
              "text": {
                "elements": [
                  {
                    "text_run": {
                      "content": `收藏时间：${formattedTime}`,
                      "text_element_style": {
                        "text_color": 7
                      }
                    }
                  }
                ],
                "style": {}
              }
            },
            {
              "block_type": 2,
              "text": {
                "elements": [
                  {
                    "text_run": {
                      "content": text,
                      "text_element_style": {}
                    }
                  }
                ],
                "style": {}
              }
            }
          ]
        };
        
        const createContentRequest = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(createContentBody)
        };
        
        // 记录API调用开始
        const createContentCallStartTime = new Date().toISOString();
        let createContentResponse, createContentData;
        try {
          createContentResponse = await fetch(createContentUrl, createContentRequest);
          createContentData = await createContentResponse.json();
          
          debugInfo.apiCalls.push({
            api: createContentUrl.toString(),
            method: 'POST',
            statusCode: createContentResponse.status,
            request: {
              headers: {
                'Authorization': 'Bearer [REDACTED]',
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: createContentBody
            },
            response: createContentData,
            startTime: createContentCallStartTime,
            endTime: new Date().toISOString()
          });
        } catch (fetchError) {
          debugInfo.apiCalls.push({
            api: createContentUrl.toString(),
            method: 'POST',
            request: {
              headers: {
                'Authorization': 'Bearer [REDACTED]',
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: createContentBody
            },
            error: fetchError.message,
            statusCode: 'NETWORK_ERROR',
            startTime: createContentCallStartTime,
            endTime: new Date().toISOString()
          });
          
          throw {
            message: `网络错误: ${fetchError.message}`,
            code: 'NETWORK_ERROR',
            debugInfo: {
              ...debugInfo,
              failedApi: createContentUrl.toString()
            }
          };
        }
        
        if (createContentData.code !== 0) {
          throw {
            message: `创建内容失败 [${createContentUrl}]: ${createContentData.msg}`,
            code: createContentData.code,
            debugInfo: {
              ...debugInfo,
              failedApi: createContentUrl.toString()
            }
          };
        }
      } else {
        // 相同标题下新增文本收藏，使用已有标题的block_id
        const createBlockUrl = String(FEISHU_API_BASE) + '/docx/v1/documents/' + String(documentId) + '/blocks/' + String(parentBlockId) + '/children?document_revision_id=-1';
        const createBlockBody = {
          "index": 0,
          "children": [
            {
              "block_type": 2,
              "text": {
                "elements": [
                  {
                    "text_run": {
                      "content": `收藏时间：${formattedTime}`,
                      "text_element_style": {
                        "text_color": 7
                      }
                    }
                  }
                ],
                "style": {}
              }
            },
            {
              "block_type": 2,
              "text": {
                "elements": [
                  {
                    "text_run": {
                      "content": text,
                      "text_element_style": {}
                    }
                  }
                ],
                "style": {}
              }
            }
          ]
        };
        
        const createBlockRequest = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(createBlockBody)
        };
        
        // 记录API调用开始
        const createBlockCallStartTime = new Date().toISOString();
        let createBlockResponse, createBlockData;
        try {
          createBlockResponse = await fetch(createBlockUrl, createBlockRequest);
          createBlockData = await createBlockResponse.json();
          
          debugInfo.apiCalls.push({
            api: createBlockUrl.toString(),
            method: 'POST',
            statusCode: createBlockResponse.status,
            request: {
              headers: {
                'Authorization': 'Bearer [REDACTED]',
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: createBlockBody
            },
            response: createBlockData,
            startTime: createBlockCallStartTime,
            endTime: new Date().toISOString()
          });
        } catch (fetchError) {
          debugInfo.apiCalls.push({
            api: createBlockUrl.toString(),
            method: 'POST',
            request: {
              headers: {
                'Authorization': 'Bearer [REDACTED]',
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: createBlockBody
            },
            error: fetchError.message,
            statusCode: 'NETWORK_ERROR',
            startTime: createBlockCallStartTime,
            endTime: new Date().toISOString()
          });
          
          throw {
            message: `网络错误: ${fetchError.message}`,
            code: 'NETWORK_ERROR',
            debugInfo: {
              ...debugInfo,
              failedApi: createBlockUrl.toString()
            }
          };
        }
        
        if (createBlockData.code !== 0) {
          throw {
            message: `创建块失败 [${createBlockUrl}]: ${createBlockData.msg}`,
            code: createBlockData.code,
            debugInfo: {
              ...debugInfo,
              failedApi: createBlockUrl.toString()
            }
          };
        }
      }

      return {
        success: true,
        docUrl: `https://my.feishu.cn/wiki/${nodeToken}`
      };
    } catch (error) {
      console.error('追加文档内容错误:', error);
      // 确保抛出的错误包含debugInfo
      if (!error.debugInfo) {
        error.debugInfo = debugInfo;
      }
      // 如果是网络错误，确保API调用记录中包含错误信息
      if (error.message && error.message.includes('fetch') || error.message.includes('network')) {
        if (debugInfo.apiCalls.length > 0) {
          const lastCall = debugInfo.apiCalls[debugInfo.apiCalls.length - 1];
          lastCall.error = error.message;
        }
      }
      throw error;
    }
  }
}

// 实例化飞书服务
const feishuService = new FeishuService();

/**
 * 消息监听器
 * 处理来自内容脚本的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToFeishu') {
    // 处理收藏请求
    handleSaveToFeishu(request.data, sendResponse);
    return true;
  } else if (request.action === 'getConfig') {
    // 获取配置信息
    feishuService.getConfig().then(config => {
      sendResponse({ success: true, config });
    });
    return true;
  } else if (request.action === 'setConfig') {
    // 保存配置信息
    feishuService.setConfig(request.config).then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'handleOAuthCallback') {
    // 处理OAuth授权回调
    handleOAuthCallback(request.code, sendResponse);
    return true;
  } else if (request.action === 'openAuthPage') {
    // 打开授权页面
    openAuthPage(sendResponse);
    return true;
  }
});

/**
 * 处理收藏到飞书的请求
 * @param {Object} data 收藏数据
 * @param {Function} sendResponse 响应回调
 */
async function handleSaveToFeishu(data, sendResponse) {
  try {
    // 调用追加文档方法
    const result = await feishuService.appendToDocument(data.text, data.url, data.title, data.timestamp);
    sendResponse(result);
  } catch (error) {
    // 处理错误
    sendResponse({
      success: false,
      error: error.message || '收藏失败',
      debugInfo: error.debugInfo || error
    });
  }
}

/**
 * 处理OAuth授权回调
 * @param {string} code 授权码
 * @param {Function} sendResponse 响应回调
 */
async function handleOAuthCallback(code, sendResponse) {
  try {
    const config = await feishuService.getConfig();
    
    if (!config.appId || !config.appSecret) {
      throw new Error('请先配置App ID和App Secret');
    }

    // 获取用户访问令牌
    const tokenResponse = await fetch(FEISHU_API_BASE + '/authen/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: chrome.identity.getRedirectURL('feishu-auth')
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.code !== 0) {
      throw {
        message: `获取访问令牌失败: ${tokenData.msg}`,
        code: tokenData.code,
        details: tokenData
      };
    }

    // 保存用户访问令牌
    await feishuService.setConfig({
      userAccessToken: tokenData.data.access_token,
      userRefreshToken: tokenData.data.refresh_token,
      userTokenExpireTime: Date.now() + (tokenData.data.expire - 300) * 1000,
      isAuthorized: true
    });

    sendResponse({ success: true, message: '授权成功' });
  } catch (error) {
    console.error('处理OAuth回调错误:', error);
    sendResponse({
      success: false,
      error: error.message || '授权失败',
      details: error.details || error
    });
  }
}

/**
 * 打开飞书授权页面
 * @param {Function} sendResponse 响应回调
 */
async function openAuthPage(sendResponse) {
  try {
    const config = await feishuService.getConfig();
    
    if (!config.appId) {
      throw new Error('请先配置App ID');
    }

    // 构造飞书授权URL
    const redirectUri = chrome.identity.getRedirectURL('feishu-auth');
    const scope = 'docx:document docx:document:write_only auth:user_access_token:read contact:user.base:readonly';
    const state = Math.random().toString(36).substring(2);

    const authUrl = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=' + config.appId + '&response_type=code&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=' + encodeURIComponent(scope) + '&state=' + state;

    // 使用chrome.identity.launchWebAuthFlow处理授权流程
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        console.error('授权流程错误:', chrome.runtime.lastError);
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message || '授权失败'
        });
        return;
      }

      // 从重定向URL中提取授权码
      const urlParams = new URLSearchParams(redirectUrl.split('?')[1]);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        sendResponse({
          success: false,
          error: `授权失败: ${urlParams.get('error_description') || error}`
        });
        return;
      }

      if (code) {
        // 处理授权码
        handleOAuthCallback(code, (response) => {
          if (response.success) {
            sendResponse({ success: true, message: '授权成功' });
          } else {
            sendResponse({
              success: false,
              error: response.error || '授权失败'
            });
          }
        });
      } else {
        sendResponse({
          success: false,
          error: '未获取到授权码'
        });
      }
    });
  } catch (error) {
    console.error('打开授权页面错误:', error);
    sendResponse({
      success: false,
      error: error.message || '打开授权页面失败'
    });
  }
}
