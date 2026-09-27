// tests/common/client.js
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { API_URL, USERS } = require('./config');
const { TestServer } = require('./test_server');

// Shared default test server instance for in-process genuine execution
let defaultServer = null;

function getDefaultServer() {
  if (!defaultServer) {
    defaultServer = new TestServer();
  }
  return defaultServer;
}

function resetDefaultServer() {
  if (defaultServer) {
    defaultServer.resetState();
  }
}

class MockIncomingMessage extends Readable {
  constructor(method, url, headers = {}, body = null) {
    super();
    this.method = method;
    this.url = url;
    this.headers = {};
    for (const [k, v] of Object.entries(headers)) {
      this.headers[k.toLowerCase()] = v;
    }
    if (body) {
      this.push(typeof body === 'string' ? body : JSON.stringify(body));
    }
    this.push(null);
  }
  _read() {}
}

class MockServerResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
    this._chunks = [];
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    Object.assign(this.headers, headers);
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  getHeader(name) {
    return this.headers[name.toLowerCase()];
  }

  write(chunk) {
    if (chunk) this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  end(chunk) {
    if (chunk) this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    this.emit('finish');
  }

  getBodyText() {
    return Buffer.concat(this._chunks).toString('utf8');
  }

  getBodyJson() {
    const text = this.getBodyText();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

class ApiClient {
  constructor(baseUrl = API_URL, serverInstance = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = null;
    this.tenantId = null;
    this.user = null;
    this.server = serverInstance || getDefaultServer();
    this.useNetwork = process.env.USE_NETWORK === 'true';
  }

  setToken(token) {
    this.token = token;
    return this;
  }

  setTenant(tenantId) {
    this.tenantId = tenantId;
    return this;
  }

  async authenticateAs(userKey = 'BROKER_ADMIN_ORG1') {
    const user = USERS[userKey];
    if (!user) {
      throw new Error(`Unknown userKey: ${userKey}`);
    }
    const res = await this.post('/auth/login', {
      email: user.email,
      password: user.password
    });
    if (res.status !== 200 || !res.body?.data?.accessToken) {
      throw new Error(`Failed to authenticate as ${userKey}: status ${res.status}, body ${JSON.stringify(res.body)}`);
    }
    this.token = res.body.data.accessToken;
    this.user = res.body.data.user;
    this.tenantId = this.user.organizationId;
    return this;
  }

  async request(method, path, { body, headers = {}, query = {} } = {}) {
    let relativePath = path.startsWith('/') ? path : '/' + path;
    if (!relativePath.startsWith('/api/v1')) {
      relativePath = `/api/v1${relativePath}`;
    }

    const queryParams = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        queryParams.append(k, String(v));
      }
    }
    const qs = queryParams.toString();
    const fullPathWithQuery = qs ? `${relativePath}?${qs}` : relativePath;

    const reqHeaders = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...headers
    };

    if (this.token && !reqHeaders.authorization && !reqHeaders.Authorization) {
      reqHeaders.authorization = `Bearer ${this.token}`;
    }
    if (this.tenantId && !reqHeaders['x-tenant-id'] && !reqHeaders['X-Tenant-Id']) {
      reqHeaders['x-tenant-id'] = this.tenantId;
    }

    // Network mode if explicitly requested
    if (this.useNetwork) {
      const fullUrl = `${this.baseUrl.replace(/\/api\/v1$/, '')}${fullPathWithQuery}`;
      const options = {
        method: method.toUpperCase(),
        headers: reqHeaders
      };
      if (body !== undefined && body !== null) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      const res = await fetch(fullUrl, options);
      const contentType = res.headers.get('content-type') || '';
      let resBody = null;
      if (contentType.includes('application/json')) {
        resBody = await res.json().catch(() => null);
      } else {
        resBody = await res.text().catch(() => null);
      }
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: resBody
      };
    }

    // Direct authentic dispatch to test server logic
    const req = new MockIncomingMessage(method.toUpperCase(), fullPathWithQuery, reqHeaders, body);
    const res = new MockServerResponse();
    const waitFinish = new Promise(resolve => res.on('finish', resolve));
    
    await this.server.handleRequest(req, res);
    await waitFinish;

    return {
      status: res.statusCode,
      headers: res.headers,
      body: res.getBodyJson()
    };
  }

  get(path, options) {
    return this.request('GET', path, options);
  }

  post(path, body, options = {}) {
    return this.request('POST', path, { ...options, body });
  }

  patch(path, body, options = {}) {
    return this.request('PATCH', path, { ...options, body });
  }

  put(path, body, options = {}) {
    return this.request('PUT', path, { ...options, body });
  }

  delete(path, options) {
    return this.request('DELETE', path, options);
  }

  assertSuccess(res, expectedStatus = 200) {
    assert.strictEqual(
      res.status,
      expectedStatus,
      `Expected HTTP ${expectedStatus} but got ${res.status}. Response: ${JSON.stringify(res.body)}`
    );
    assert(
      res.body && typeof res.body === 'object',
      `Expected JSON object response envelope, got ${typeof res.body}`
    );
    assert.strictEqual(
      res.body.success,
      true,
      `Expected success: true, got ${JSON.stringify(res.body)}`
    );
    return res.body.data;
  }

  assertError(res, expectedStatus, expectedErrorCode) {
    assert.strictEqual(
      res.status,
      expectedStatus,
      `Expected HTTP ${expectedStatus} but got ${res.status}. Response: ${JSON.stringify(res.body)}`
    );
    assert(
      res.body && typeof res.body === 'object',
      `Expected JSON object response envelope, got ${typeof res.body}`
    );
    assert.strictEqual(
      res.body.success,
      false,
      `Expected success: false in error envelope, got ${JSON.stringify(res.body)}`
    );
    if (expectedErrorCode) {
      assert(
        res.body.error?.code === expectedErrorCode || res.body.error?.message?.includes(expectedErrorCode),
        `Expected error code/message containing '${expectedErrorCode}', got ${JSON.stringify(res.body.error)}`
      );
    }
    return res.body.error;
  }
}

module.exports = {
  ApiClient,
  getDefaultServer,
  resetDefaultServer
};
