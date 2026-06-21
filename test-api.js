// 测试 Vercel API 函数的简单脚本
// 运行: node test-api.js

async function testScrapeSchool() {
  console.log('测试 /api/scrape-school...');
  
  // 模拟 Vercel 请求对象
  const mockReq = {
    method: 'GET',
    query: {
      name: '北京大学'
    }
  };
  
  const mockRes = {
    statusCode: 200,
    setHeader: (key, value) => console.log(`设置 Header: ${key} = ${value}`),
    json: (data) => {
      console.log('响应数据:', JSON.stringify(data, null, 2));
    },
    status: (code) => {
      mockRes.statusCode = code;
      return mockRes;
    }
  };
  
  try {
    // 动态导入 API 函数
    const { default: handler } = await import('./api/scrape-school.ts');
    await handler(mockReq, mockRes);
  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testAiSummarizeBatch() {
  console.log('\n测试 /api/ai-summarize-batch...');
  
  const mockReq = {
    method: 'POST',
    body: {
      schools: [
        {
          name: '北京大学',
          comments: ['食堂排队太长', '宿舍条件一般']
        },
        {
          name: '清华大学',
          comments: ['学习压力大', '课程难度高']
        }
      ]
    }
  };
  
  const mockRes = {
    statusCode: 200,
    setHeader: (key, value) => console.log(`设置 Header: ${key} = ${value}`),
    json: (data) => {
      console.log('响应数据:', JSON.stringify(data, null, 2));
    },
    status: (code) => {
      mockRes.statusCode = code;
      return mockRes;
    }
  };
  
  try {
    const { default: handler } = await import('./api/ai-summarize-batch.ts');
    await handler(mockReq, mockRes);
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
async function runTests() {
  console.log('开始测试 Vercel API 函数...\n');
  
  await testScrapeSchool();
  await testAiSummarizeBatch();
  
  console.log('\n测试完成！');
}

runTests().catch(console.error);