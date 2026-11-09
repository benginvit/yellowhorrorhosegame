// Module resolve hook for the unit tests: the level collider modules import their
// siblings without a file extension (as vite resolves them); Node needs ".js".
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.js`, context)
    throw e
  }
}
