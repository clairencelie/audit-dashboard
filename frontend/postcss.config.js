import tailwindcss from '@tailwindcss/postcss'
import oklabFunction from '@csstools/postcss-oklab-function'

// Strip "in oklab" from Tailwind v4 gradient positions — Chrome < 111 (Windows 7 max is Chrome 109)
// rejects the gradient entirely when it sees unknown color-space syntax, leaving no background.
const stripOklabGradient = () => ({
  postcssPlugin: 'strip-oklab-gradient',
  Declaration(decl) {
    if (decl.prop === '--tw-gradient-position' && decl.value.includes(' in oklab')) {
      decl.value = decl.value.replace(/ in oklab/g, '')
    }
  },
})
stripOklabGradient.postcss = true

export default {
  plugins: [
    tailwindcss(),
    stripOklabGradient(),
    oklabFunction({ preserve: true }),
  ],
}
