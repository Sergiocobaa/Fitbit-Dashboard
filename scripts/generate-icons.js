// Genera los iconos PNG de la PWA a partir de public/logo-icon.svg.
// Uso: node scripts/generate-icons.js
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const publicDir = path.join(__dirname, '..', 'public')
const svg = path.join(publicDir, 'logo-icon.svg')

const sizes = [192, 512]

async function run() {
  const input = fs.readFileSync(svg)
  await Promise.all(
    sizes.map((size) =>
      sharp(input)
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, `icon-${size}.png`))
    )
  )
  console.log(`Iconos generados: ${sizes.map((s) => `icon-${s}.png`).join(', ')}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
