const path = require("path")

module.exports = {
  mode: "none",
  entry: {
    "vm.js": "./index.js",
    "core.js": "./core.js",
    "stdlib.js": "./stdlib.js"
  },
  target: "web",
  node: {
    fs: "empty"
  },
  resolve: {
    alias: {
      vm: path.resolve(__dirname, "../dist/src/vm")
    }
  },
  output: {
    filename: "[name]",
    path: path.resolve(__dirname, "./dist")
  }
}
