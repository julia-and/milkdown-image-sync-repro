# Bug: `proxyDomURL` is not re-evaluated after its `Promise` resolves to a placeholder

**Package:** `@milkdown/components` · **Affects:** `image-block`, `image-inline` · **Version:** 7.19.0

## Reproduction

```bash
npm install
npm run dev
```

The editor loads with an image that uses a custom `custom://` URL scheme. `proxyDomURL` is called at mount time, the image is not yet in the store, and it returns a `Promise` resolving to a placeholder. After 3 seconds the image "becomes available" (simulating a background sync). The placeholder never updates.

## Expected behaviour

When an image that was previously unavailable becomes available, there should be a supported way to push the resolved URL into the image node view so it displays the real image without remounting the editor.

## Actual behaviour

The placeholder is permanent. Once `proxyDomURL` returns a resolved `Promise<string>`, the `src` ref inside the node view is set once and never updated again unless a ProseMirror transaction happens to call `update()` on the node view with changed attrs.

## Root cause

In `packages/components/src/image-block/view/index.ts` (identical pattern in `image-inline/view.ts`), `bindAttrs` calls `proxyDomURL` and attaches a `.then` to update the reactive `src` ref:

```ts
const proxiedURL = proxyDomURL(node.attrs.src)
if (typeof proxiedURL === 'string') {
  src.value = proxiedURL
} else {
  proxiedURL.then((url) => { src.value = url }).catch(console.error)
}
```

Once the promise resolves there is no further mechanism to update `src.value`. `bindAttrs` is only called again if the node view's `update()` fires, which requires a ProseMirror transaction that actually modifies the node. In practice this means:

- Typing or making other edits will incidentally trigger `update()` and fix the image — but only by luck.
- A `setNodeAttribute` transaction with the same value is swallowed before reaching the view update cycle when `y-prosemirror`'s `ySyncPlugin` is active, so there is no reliable way to force a re-evaluation from application code.

The only working workaround we found is reaching into Vue 3 internals on the node view's DOM element:

```ts
// Workaround — relies on undocumented Vue internals
view.state.doc.descendants((node, pos) => {
  if (!node.attrs?.src?.startsWith("custom://")) return
  const blobUrl = store.get(node.attrs.src)
  if (!blobUrl) return
  const dom = view.nodeDOM(pos)
  const srcRef = (dom as any)?.__vue_app__?._instance?.props?.src
  if (srcRef && "value" in srcRef) srcRef.value = blobUrl
})
```

## Proposed fix

Pass an `onUpdate` callback as a second argument to `proxyDomURL`. The consumer calls it whenever a new URL is available; Milkdown writes it directly to the `src` ref. This is fully backwards-compatible — existing implementations that take only one argument continue to work.

**`packages/components/src/image-block/config.ts`** (and `image-inline/config.ts`):

```diff
-  proxyDomURL?: (url: string) => Promise<string> | string
+  proxyDomURL?: (url: string, onUpdate: (url: string) => void) => Promise<string> | string
```

**`packages/components/src/image-block/view/index.ts`** (and `image-inline/view.ts`):

```diff
-  const proxiedURL = proxyDomURL(node.attrs.src)
+  const proxiedURL = proxyDomURL(node.attrs.src, (url) => { src.value = url })
```

That is the complete change — one line in each of four files.

With this fix, application code can handle deferred image availability cleanly:

```ts
proxyDomURL: (url, onUpdate) => {
  if (!url.startsWith("custom://")) return url
  const id = url.slice("custom://".length)

  const cached = store.get(id)
  if (cached) return cached

  // Register for a future push and return placeholder for now
  watchForImage(id).then(blobUrl => onUpdate(blobUrl))
  return PLACEHOLDER
}
```

## Context

This came up in a local-first app where image blobs are stored in IndexedDB and synced across devices via Dexie Cloud. When device B opens a note containing an image uploaded by device A, the ProseMirror document (backed by `y-prosemirror`) syncs quickly, but the image blob arrives in a separate sync pass. `proxyDomURL` is called before the blob is present, returns a placeholder, and there is currently no way to update it when the blob arrives — short of the Vue internals hack above.
