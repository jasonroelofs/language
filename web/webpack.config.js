const path = require("path")

module.exports = {
  mode: "none",
  entry: {
    "vm.js": "./index.js",
    "core.js": "./core.js",
    "stdlib.js": "./stdlib.js",
    "specs.js": "./specs.js",
    "fake_fs.js": "./fake_fs.js"
  },
  target: "web",
  node: {
    fs: "empty"
  },
  resolve: {
    alias: {
      vm: path.resolve(__dirname, "../dist/src/vm"),
      perf_hooks: path.resolve(__dirname, "./empty.js")
    }
  },
  output: {
    filename: "[name]",
    path: path.resolve(__dirname, "./dist")
  }
}
