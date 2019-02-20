// Platform encapsulates the differences and hooks between running
// the language on the web vs running it as a command line tool.

var fs = require("fs")
var glob = require("fast-glob")
var path = require("path")

var Platform: any = {
  isNode: () => {
    return (typeof window === "undefined")
  },
}

if(Platform.isNode()) {
  var { performance } = require("perf_hooks")

  Platform.isDirectory = (path) => {
    let stats = fs.lstatSync(path)
    return stats.isDirectory()
  }

  Platform.readFile = (filePath) => {
    return fs.readFileSync(filePath)
  }

  Platform.fileSearch = (entries) => {
    return glob.sync(entries)
  }

  Platform.findCoreLibs = (callback) => {
    let coreDir = path.resolve(__dirname + "/../../lib/core");
    let entries = glob.sync([`${coreDir}/**/*.lang`]).forEach((file) => {
      let path = (typeof(file) == "string") ? file : file.path
      callback(path, fs.readFileSync(path).toString())
    })
  }

  Platform.findStdLibs = (callback) => {
    let stdlibDir = path.resolve(__dirname + "/../../lib/stdlib");
    let entries = glob.sync([`${stdlibDir}/**/*.lang`]).forEach((file) => {
      let path = (typeof(file) == "string") ? file : file.path
      callback(path, fs.readFileSync(path).toString())
    })
  }

  Platform.nextTick = (callback) => {
    setImmediate(callback)
  }

  Platform.now = () => {
    return performance.now()
  }

} else {

  Platform.isDirectory = () => {
    return false
  }

  Platform.fileSearch = () => {}

  Platform.readFile = (filePath) => {
    return (<any>window).FakeFS.get(filePath)
  }

  Platform.findCoreLibs = (callback) => {
    let coreFiles = (<any>window).FakeFS.all("lib/core")
    coreFiles.forEach((content, path) => {
      callback(path, content)
    })
  }

  Platform.findStdLibs = (callback) => {
    let stdlibFiles = (<any>window).FakeFS.all("lib/stdlib")
    stdlibFiles.forEach((content, path) => {
      callback(path, content)
    })
  }

  Platform.nextTick = (callback) => {
    setTimeout(callback, 0)
  }

  Platform.now = () => {
    return Date.now()
  }
}

export default Platform
