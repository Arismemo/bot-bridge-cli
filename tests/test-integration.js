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

const runTests = async () => {
  console.log('Running Integration Tests...');

  // 设置测试环境（在加载服务器模块之前）
  process.env.TEST_DB_PATH = DB_PATH;
  process.env.PORT = 3999; // 使用测试端口
  process.env.BRIDGE_API_URL = `http://localhost:${process.env.PORT}`; // 客户端测试连接的地址

  // 删除测试数据库（如果存在）
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  // 现在加载服务器模块
  const server = require('../server/index');
  const serverTest = require('./test-server');
  const clientTest = require('./test-client');

  // 填充测试队列
  serverTest();
  clientTest();

  // 启动服务器
  await new Promise((resolve, reject) => {
    app = server;
    serverInstance = app.listen(process.env.PORT, () => {
      console.log(`Test server running on http://0.0.0.0:${process.env.PORT}`);
      resolve();
    }).on('error', reject);
  });

  // 执行所有 beforeAll 钩子
  for (const hook of beforeAllQueue) {
    await hook();
  }

  // 运行所有测试
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
  for (const hook of afterAllQueue) {
    await hook();
  }

  // 最后关闭服务器
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('Test server closed.');
    });
  }

  // 清理测试数据库
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  console.log(`\nTest Results: ${global.passed} passed, ${global.failed} failed`);
  process.exit(global.failed > 0 ? 1 : 0);
};

runTests();
