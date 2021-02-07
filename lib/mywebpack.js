const path = require('path')
const Compiler = require('./compiler.js')
const config = require(path.resolve('./build/webpack.config.js'))

const compiler = new Compiler(config)
compiler.run()