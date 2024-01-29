import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import postcss from 'rollup-plugin-postcss'

import withSolid from 'rollup-preset-solid'

import tailwindConfig from './tailwind.config.js'

export default withSolid({
  input: 'src/index.tsx',
  targets: ['esm', 'cjs'],
  watch: {
    include: 'src/**',
  },
  plugins: [
    postcss({
      extensions: ['.css', '.module.css'],
      plugins: [autoprefixer(), tailwind(tailwindConfig)],
    }),
  ],
})
