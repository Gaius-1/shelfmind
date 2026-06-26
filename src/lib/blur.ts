/**
 * Calculates the variance of the Laplacian of an image to estimate blurriness.
 * Higher values = sharper image, lower values = blurrier image.
 * Typical thresholds are around 100-300 depending on the camera and context.
 */
export function calculateBlurScore(imageData: ImageData): number {
  const width = imageData.width
  const height = imageData.height
  const data = imageData.data

  // 1. Convert to grayscale using luminance formula
  const grayscale = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i += 4) {
    grayscale[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
  }

  // 2. Apply Laplacian filter (3x3 kernel)
  // Kernel:
  //  0  1  0
  //  1 -4  1
  //  0  1  0
  const laplacian = new Int16Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const top = grayscale[idx - width]
      const bottom = grayscale[idx + width]
      const left = grayscale[idx - 1]
      const right = grayscale[idx + 1]
      const center = grayscale[idx]
      laplacian[idx] = top + bottom + left + right - 4 * center
    }
  }

  // 3. Calculate variance of the Laplacian
  let sum = 0
  let count = 0
  
  // Exclude borders where laplacian wasn't calculated
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      sum += laplacian[y * width + x]
      count++
    }
  }
  const mean = sum / count

  let varianceSum = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const diff = laplacian[y * width + x] - mean
      varianceSum += diff * diff
    }
  }

  return varianceSum / count
}
