/**
 * Mock HTTP Client for testing
 * Simulates HTTP requests without real network calls
 */
class MockHttpClient {
  constructor() {
    this.getResponses = {};
    this.postResponses = {};
    this.putResponses = {};
    this.deleteResponses = {};
    this.getCalls = [];
    this.postCalls = [];
    this.putCalls = [];
    this.deleteCalls = [];
  }

  /**
   * Set mock response for GET request
   */
  setGetResponse(url, response) {
    this.getResponses[url] = response;
  }

  /**
   * Set mock response for POST request
   */
  setPostResponse(url, response) {
    this.postResponses[url] = response;
  }

  /**
   * Set mock response for PUT request
   */
  setPutResponse(url, response) {
    this.putResponses[url] = response;
  }

  /**
   * Set mock response for DELETE request
   */
  setDeleteResponse(url, response) {
    this.deleteResponses[url] = response;
  }

  /**
   * Simulate GET request
   */
  async get(url, options = {}) {
    this.getCalls.push({ url, options });
    const response = this.getResponses[url];
    if (response !== undefined) {
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }
    return Promise.reject(new Error(`No mock response for GET ${url}`));
  }

  /**
   * Simulate POST request
   */
  async post(url, data = null, options = {}) {
    this.postCalls.push({ url, data, options });
    const response = this.postResponses[url];
    if (response !== undefined) {
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }
    return Promise.reject(new Error(`No mock response for POST ${url}`));
  }

  /**
   * Simulate PUT request
   */
  async put(url, data = null, options = {}) {
    this.putCalls.push({ url, data, options });
    const response = this.putResponses[url];
    if (response !== undefined) {
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }
    return Promise.reject(new Error(`No mock response for PUT ${url}`));
  }

  /**
   * Simulate DELETE request
   */
  async delete(url, options = {}) {
    this.deleteCalls.push({ url, options });
    const response = this.deleteResponses[url];
    if (response !== undefined) {
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }
    return Promise.reject(new Error(`No mock response for DELETE ${url}`));
  }

  /**
   * Check if endpoint was called
   */
  wasCalled(method, url) {
    const calls = this[`${method.toLowerCase()}Calls`];
    return calls && calls.some(call => call.url === url);
  }

  /**
   * Get number of calls to endpoint
   */
  callCount(method, url) {
    const calls = this[`${method.toLowerCase()}Calls`];
    if (!calls) return 0;
    return calls.filter(call => call.url === url).length;
  }

  /**
   * Clear all recorded data
   */
  clear() {
    this.getResponses = {};
    this.postResponses = {};
    this.putResponses = {};
    this.deleteResponses = {};
    this.getCalls = [];
    this.postCalls = [];
    this.putCalls = [];
    this.deleteCalls = [];
  }
}

module.exports = MockHttpClient;
