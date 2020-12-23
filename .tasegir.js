module.exports = {
  lint: {
    files: ['src/**/*', 'test/**/*']
  },
  depCheck: {
    ignore: [
      'typedoc', 'typedoc-plugin-markdown', '@types/*', 'tasegir',  '@oclif/*', 'reflect-metadata', 'sqlite3',
      'cross-env', 'libp2p', 'libp2p-crypto'
    ]
  },
  tsconfig: {
    compilerOptions: {
      skipLibCheck: true
    }
  }
}
