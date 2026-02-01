const axios = require('axios');
const IHttpClient = require('../interfaces/IHttpClient');

/**
 * Default HTTP client implementation using axios
 */
class DefaultHttpClient extends IHttpClient {
  constructor(config = {}) {
    super();
    this.axios = axios.create({
      timeout: 5000,
      ...config
    });
  }

  /**
   * Perform GET request
   */
  async get(url, options = {}) {
    return await this.axios.get(url, options);
  }

  /**
   * Perform POST request
   */
  async post(url, data = null, options = {}) {
    return await this.axios.post(url, data, options);
  }

  /**
   * Perform PUT request
   */
  async put(url, data = null, options = {}) {
    return await this.axios.put(url, data, options);
  }

  /**
   * Perform DELETE request
   */
  async delete(url, options = {}) {
    return await this.axios.delete(url, options);
  }
}

module.exports = DefaultHttpClient;
