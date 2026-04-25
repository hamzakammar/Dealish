/**
 * Races a promise against a wall-clock timeout (Supabase/location can hang without rejecting).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('async_timeout')), ms)
    promise
      .then((v) => {
        clearTimeout(id)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(id)
        reject(e)
      })
  })
}
