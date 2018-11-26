/**
 * Due to writing a language, we have a tendency of using similar names
 * to existing Javascript objects like Object and Array.
 * This module provides access so some things that get difficult to access
 * in such cases.
 */

export function isArray(obj) {
  return Array.isArray(obj)
}

export function arrayFrom(obj) {
  return Array.from(obj)
}
