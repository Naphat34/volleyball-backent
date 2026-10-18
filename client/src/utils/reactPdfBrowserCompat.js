// @react-pdf/layout checks Buffer.isBuffer while resolving images, but browsers
// do not provide Node's global Buffer. PDF image parsing itself uses the
// renderer's browser implementation, so the layout check only needs a safe
// browser-side Buffer predicate.
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = {
    isBuffer: (value) => value instanceof Uint8Array && value._isBuffer === true,
  };
}
