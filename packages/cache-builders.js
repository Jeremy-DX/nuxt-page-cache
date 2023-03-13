const Promise = require('bluebird')
const cacheManager = require('cache-manager')

function memoryCache(config) {
  return cacheManager.caching({
    store: 'memory',
    ...config
  })
}

function multiCache(config) {
  const stores = config.stores.map(makeCache)
  return cacheManager.multiCaching(stores)
}

const cacheBuilders = {
  memory: memoryCache,
  multi: multiCache
}

function makeCache(config = { type: 'memory' }) {
  const builder = cacheBuilders[config.type]
  if (!builder) {
    throw new Error('Unknown store type: ' + config.type)
  }

  return Promise.promisifyAll(builder(config))
}

module.exports = makeCache
