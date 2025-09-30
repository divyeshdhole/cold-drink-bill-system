// Utility to export a DOM node to a PNG file using html-to-image
// Note: ensure `html-to-image` is installed: npm i html-to-image

export async function exportNodeToPng(node, fileName = 'bill.png', scale = 2) {
  if (!node) throw new Error('exportNodeToPng: node is required')
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(node, {
    pixelRatio: scale,
    cacheBust: true,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left'
    }
  })
  const link = document.createElement('a')
  link.download = fileName
  link.href = dataUrl
  link.click()
  return dataUrl
}
