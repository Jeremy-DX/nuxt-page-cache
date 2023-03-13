const path = require('path')
const { serialize, deserialize } = require('./serializer')
const makeCache = require('./cache-builders')

function cleanIfNewVersion(cache, version) {
  if (!version) { return }
  return cache.getAsync('appVersion')
    .then(function (oldVersion) {
      if (oldVersion !== version) {
        console.log(`Cache updated from ${oldVersion} to ${version}`)
        return cache.resetAsync()
        // unfortunately multi cache doesn't return a promise
        // and we can't await for it so as to store new version
        // immediately after reset.
      }
    })
}

function tryStoreVersion(cache, version) {
  if (!version || cache.versionSaved) { return }
  return cache.setAsync('appVersion', version, { ttl: null })
    .then(() => { cache.versionSaved = true })
}

module.exports = function cacheRenderer(moduleOptions) {
  const { nuxt, options } = this

  if (!moduleOptions || !Array.isArray(moduleOptions.pages) || !moduleOptions.pages.length || !nuxt.renderer) {
    return
  }

  function isCacheFriendly(path, context) {
    if (typeof (moduleOptions.isCacheable) === 'function') {
      return moduleOptions.isCacheable(path, context)
    }

    return !context.res.spa &&
      moduleOptions.pages.some(pat =>
        pat instanceof RegExp
          ? pat.test(path)
          : path.startsWith(pat)
      )
  }

  function defaultCacheKeyBuilder(route, context) {
    if (!isCacheFriendly(route, context)) { return false }
    const hostname =
      (context.req && context.req.hostname) ||
      (context.req && context.req.host) ||
      (context.req && context.req.headers && context.req.headers.host) ||
      (context.req && context.req.headers && context.req.headers.hostname)
    if (!hostname) { return }
    const cacheKey = moduleOptions.useHostPrefix === true && hostname
      ? path.join(hostname, route)
      : route

    return cacheKey
  }

  function cacheKeyBuilder(key, route, context) {
    if (!key || Object.prototype.toString.call(key) !== '[object Function]') { return defaultCacheKeyBuilder(route, context) }
    return key(route, context) || defaultCacheKeyBuilder(route, context)
  }

  const currentVersion = options.version || moduleOptions.version
  const cache = makeCache(moduleOptions.store)
  cleanIfNewVersion(cache, currentVersion)

  const renderer = nuxt.renderer
  const renderRoute = renderer.renderRoute.bind(renderer)
  renderer.renderRoute = function (route, context) {
    // hopefully cache reset is finished up to this point.
    tryStoreVersion(cache, currentVersion)
    // 1 key false default
    // 2 key function false default
    // 3 key function true not default

    const cacheKey = cacheKeyBuilder(moduleOptions.key, route, context)
    if (!cacheKey) { return renderRoute(route, context) }

    function renderSetCache() {
      return renderRoute(route, context)
        .then(function (result) {
          if (!result.error && !result.redirected) {
            cache.setAsync(cacheKey, serialize(result))
          }
          return result
        })
    }

    return cache.getAsync(cacheKey)
      .then(function (cachedResult) {
        if (cachedResult) {
          if (process.env.NODE_ENV !== 'production') {
            const { sizeof } = require('./performance')
            console.log(sizeof(cachedResult) + 'kb')
          }
          return deserialize(cachedResult)
        }

        return renderSetCache()
      })
      .catch(renderSetCache)
  }

  return cache
}
