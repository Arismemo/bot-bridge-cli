/**
 * HTTP Client Interface
 * Defines the contract for HTTP communication implementations
 */
class IHttpClient {
  /**
   * Perform GET request
   * @param {string} url - Request URL
   * @param {object} options - Request options (headers, params, etc.)
   * @returns {Promise<any>} - Response data
   */
  async get(url, options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Perform POST request
   * @param {string} url - Request URL
   * @param {object} data - Request body data
   * @param {object} options - Request options
   * @returns {Promise<any>} - Response data
   */
  async post(url, data = null, options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Perform PUT request
   * @param {string} url - Request URL
   * @param {object} data - Request body data
   * @param {object} options - Request options
   * @returns {Promise<any>} - Response data
   */
  async put(url, data = null, options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Perform DELETE request
   * @param {string} url - Request URL
   * @param {object} options - Request options
   * @returns {Promise<any>} - Response data
   */
  async delete(url, options = {}) {
    throw new Error('Not implemented');
  }
}

module.exports = IHttpClient;
