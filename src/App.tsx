import { useEffect, useRef, useState } from "react"
import { Crepe, CrepeFeature } from "@milkdown/crepe"
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react"
import "@milkdown/crepe/theme/common/style.css"

// Simulates an image store that starts empty and gains an image after a delay.
// In real use this could be a database that receives synced blobs from a remote peer.
const imageStore = new Map<string, string>()

const FAKE_IMAGE_ID = "demo-image-id"
const PLACEHOLDER = "https://placehold.co/400x80/f5f5f5/999?text=Image+not+available+yet"

// The initial document contains an image block referencing an ID not yet in the store.
const INITIAL_MARKDOWN = `# proxyDomURL repro

The image below references \`custom://demo-image-id\`.
When the editor mounts, \`proxyDomURL\` is called, the ID is not in the store,
and it returns a Promise that resolves to a placeholder.

After **3 seconds** the image is added to the store. Nothing happens.

Expected: \`proxyDomURL\` is re-evaluated (or an equivalent refresh API exists)
so the real image appears without remounting the editor.

![demo](custom://demo-image-id)
`

function Editor() {
  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: INITIAL_MARKDOWN,
      featureConfigs: {
        [CrepeFeature.ImageBlock]: {
          proxyDomURL: (url: string) => {
            if (!url.startsWith("custom://")) return url
            const id = url.slice("custom://".length)

            const cached = imageStore.get(id)
            if (cached) {
              console.log("[proxyDomURL] cache hit for", id)
              return cached
            }

            console.log("[proxyDomURL] miss for", id, "— returning placeholder promise")
            // Simulate an async lookup that fails initially
            return Promise.resolve(PLACEHOLDER)
          },
        },
      },
    })
    return crepe
  }, [])

  return <Milkdown />
}

export default function App() {
  const [imageAvailable, setImageAvailable] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    // After 3 seconds, "sync" the image into the store
    timerRef.current = setTimeout(() => {
      // A small green square as a data URL, representing the now-available image
      const canvas = document.createElement("canvas")
      canvas.width = 400
      canvas.height = 80
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
      ctx.fillStyle = "#22c55e"
      ctx.fillRect(0, 0, 400, 80)
      ctx.fillStyle = "white"
      ctx.font = "bold 20px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("✓ Image loaded after sync", 200, 40)
      const dataUrl = canvas.toDataURL()

      imageStore.set(FAKE_IMAGE_ID, dataUrl)
      setImageAvailable(true)
      console.log(
        "[store] image added —",
        "proxyDomURL has been cached but the editor still shows the placeholder.",
        "There is no API to notify the image block to re-evaluate proxyDomURL."
      )
    }, 3000)
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", fontFamily: "sans-serif" }}>
      <div
        style={{
          padding: "8px 16px",
          marginBottom: 16,
          borderRadius: 6,
          background: imageAvailable ? "#dcfce7" : "#fef9c3",
          border: `1px solid ${imageAvailable ? "#86efac" : "#fde047"}`,
          fontSize: 14,
        }}
      >
        {imageAvailable
          ? "✓ Image is now in the store — but the editor still shows the placeholder (bug)."
          : "⏳ Image will be added to the store in 3 seconds…"}
      </div>
      <MilkdownProvider>
        <Editor />
      </MilkdownProvider>
    </div>
  )
}
