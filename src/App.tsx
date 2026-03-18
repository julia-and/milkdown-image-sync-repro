import { useEffect, useRef, useState } from "react"
import { Crepe, CrepeFeature } from "@milkdown/crepe"
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react"
import "@milkdown/crepe/theme/common/style.css"

// Simulates an image store that starts empty and gains an image after a delay.
// In real use this could be an IndexedDB table receiving synced blobs from a remote peer.
const imageStore = new Map<string, string>()
const updateCallbacks = new Map<string, (url: string) => void>()

const PLACEHOLDER = "https://placehold.co/400x80/f5f5f5/999?text=Image+not+available+yet"

function makeGreenImage(): string {
  const canvas = document.createElement("canvas")
  canvas.width = 400; canvas.height = 80
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#22c55e"
  ctx.fillRect(0, 0, 400, 80)
  ctx.fillStyle = "white"
  ctx.font = "bold 20px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("✓  Image loaded after sync", 200, 40)
  return canvas.toDataURL()
}

const INITIAL_MARKDOWN = `# proxyDomURL repro

The image below uses a custom \`custom://\` URL scheme.
When the editor mounts the image is not yet in the store, so \`proxyDomURL\`
returns a placeholder. After 3 seconds the image "syncs in".

**Without the \`onUpdate\` callback the placeholder never updates.**

![demo image](custom://demo-image-id)
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
            if (cached) return cached

            // Image not available yet — return placeholder.
            // When it becomes available we have no way to update the node view.
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
  const [status, setStatus] = useState<"waiting" | "available">("waiting")
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      const dataUrl = makeGreenImage()
      imageStore.set("demo-image-id", dataUrl)
      setStatus("available")

      // Notify any registered onUpdate callbacks (would fix the issue)
      const cb = updateCallbacks.get("demo-image-id")
      if (cb) cb(dataUrl)

      console.log(
        "[store] image added.",
        updateCallbacks.size > 0
          ? "onUpdate callback fired — image should update."
          : "No onUpdate callback available — image stays as placeholder (bug)."
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
          background: status === "available" ? "#dcfce7" : "#fef9c3",
          border: `1px solid ${status === "available" ? "#86efac" : "#fde047"}`,
          fontSize: 14,
        }}
      >
        {status === "available"
          ? "✓ Image is now in the store — but the editor still shows the placeholder (bug)."
          : "⏳ Image will be added to the store in 3 seconds…"}
      </div>
      <MilkdownProvider>
        <Editor />
      </MilkdownProvider>
    </div>
  )
}
