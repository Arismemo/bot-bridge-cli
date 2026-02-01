// tests/test-integration.js
const fs = require('fs');
const path = require('path');

let app;
let serverInstance; // 用于存储服务器实例
const DB_PATH = path.join(__dirname, 'test-messages.db');

// 全局测试变量
global.passed = 0;
global.failed = 0;
global.currentDescribeName = ''; // 记录当前 describe 名称
global.testQueue = []; // 存储所有测试函数，以便异步执行和等待

global.describe = (name, fn) => {
  global.currentDescribeName = name;
  fn();
  global.currentDescribeName = '';
};

global.test = (name, fn) => {
  global.testQueue.push({
    describe: global.currentDescribeName,
    name: name,
    fn: fn
  });
};

global.expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
  },
  toBeDefined: () => {
    if (actual === undefined || actual === null) throw new Error('Expected value to be defined');
  },
  toContain: (expected) => {
    if (!actual.includes(expected)) throw new Error(`Expected to contain ${expected}`);
  },
  toHaveLength: (expected) => {
    if (actual.length !== expected) throw new Error(`Expected length ${expected}, got ${actual.length}`);
  },
  toBeGreaterThan: (expected) => {
    if (actual <= expected) throw new Error(`Expected > ${expected}, got ${actual}`);
  },
  toBeGreaterThanOrEqual: (expected) => {
    if (actual < expected) throw new Error(`Expected >= ${expected}, got ${actual}`);
  },
  toBeTruthy: () => {
    if (!actual) throw new Error('Expected truthy value');
  },
  toBeFalsy: () => {
    if (actual) throw new Error('Expected falsy value');
  },
  toEqual: (expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  },
  // 新增 expect 的 mock 方法，以支持 test-webhook.js 中的 jest.fn 模拟
  toHaveBeenCalled: () => {
    if (typeof actual !== 'function' || !actual.called) throw new Error('Expected mock function to have been called');
  },
  toHaveBeenCalledWith: (...args) => {
    if (typeof actual !== 'function' || !actual.calledWith(...args)) throw new Error(`Expected mock function to have been called with ${JSON.stringify(args)}`);
  },
  // 新增 not 属性
  not: {
    toHaveBeenCalled: () => {
      if (typeof actual !== 'function') throw new Error('Expected a mock function');
      if (actual.called) throw new Error('Expected mock function NOT to have been called');
    },
    toHaveBeenCalledWith: (...args) => {
      if (typeof actual !== 'function') throw new Error('Expected a mock function');
      if (actual.calledWith(...args)) throw new Error(`Expected mock function NOT to have been called with ${JSON.stringify(args)}`);
    }
  }
});

let beforeAllQueue = [];
let afterAllQueue = [];
let beforeEachQueue = [];
let afterEachQueue = [];

global.beforeAll = (fn) => beforeAllQueue.push(fn);
global.afterAll = (fn) => afterAllQueue.push(fn);
global.beforeEach = (fn) => beforeEachQueue.push(fn);
global.afterEach = (fn) => afterEachQueue.push(fn);

const runAllTests = async () => {
  console.log('Starting All Tests...');

  // 设置主测试环境（在加载服务器模块之前）
  process.env.TEST_DB_PATH = DB_PATH;
  process.env.PORT = 3999; // 主测试服务器端口
  process.env.BRIDGE_API_URL = `http://localhost:${process.env.PORT}`; // 客户端测试连接的地址

  // 删除测试数据库（如果存在）
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  // 加载并运行各个测试模块，它们会填充 global.testQueue
  const { app: expressApp, server } = require('../server/index');
  app = expressApp; // 提供给 test-server.js
  const runServerTests = require('./test-server');
  const runClientTests = require('./test-client');
  const runWebhookTests = require('./test-webhook');

  // 启动主服务器 (用于 test-server 和 test-client)
  await new Promise((resolve, reject) => {
    serverInstance = server.listen(process.env.PORT, () => {
      console.log(`Main Test Server running on http://0.0.0.0:${process.env.PORT}`);
      resolve();
    }).on('error', reject);
  });

  // 填充所有测试队列
  console.log('\nCollecting Server Tests...');
  runServerTests();
  console.log('Collecting Client Tests...');
  runClientTests();
  console.log('Collecting Webhook Tests...');
  runWebhookTests(); // Webhook 测试将在自己的服务器上运行，但其 describe/test 块会填充到全局 testQueue

  // 执行所有 beforeAll 钩子 (包括主服务器和 webhook 服务器的)
  console.log('\nRunning beforeAll hooks...');
  for (const hook of beforeAllQueue) {
    await hook();
  }

  // 运行所有测试
  console.log('\nRunning all collected tests...');
  for (const testItem of global.testQueue) {
    console.log(`\n${testItem.describe}`);
    try {
      for (const hook of beforeEachQueue) {
        await hook();
      }
      await testItem.fn();
      console.log(`  ✓ ${testItem.name}`);
      global.passed++;
    } catch (err) {
      console.error(`  ✗ ${testItem.name}`);
      console.error(`    Error: ${err.message}`);
      global.failed++;
    } finally {
      for (const hook of afterEachQueue) {
        await hook();
      }
    }
  }

  // 执行所有 afterAll 钩子
  console.log('\nRunning afterAll hooks...');
  for (const hook of afterAllQueue) {
    await hook();
  }

  // 最后关闭主服务器
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('Main Test Server closed.');
    });
  }

  // 清理测试数据库
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  console.log(`\n================================`);
  console.log(`Total Test Results: ${global.passed} passed, ${global.failed} failed`);
  console.log(`================================`);
  process.exit(global.failed > 0 ? 1 : 0);
};

runAllTests();
