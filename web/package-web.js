#!/usr/bin/env node

// This script packages up our core and standard libraries into a JSON
// object that can be pulled in on the web.
// There's probably a way to hook this into webpack proper so it doesn't
// need to be two steps but couldn't find anything specific at this time.

var path = require("path")
var fs = require("fs")
var glob = require("fast-glob")

function writeTo(fileGlob, varName, fileName) {
  var here = path.resolve(__dirname)
  var codeHome = path.resolve(here, "..")
  var fileList = glob.sync([path.resolve(here, fileGlob)])

  var body = `
(function() {
`

  fileList.forEach((filePath) => {
    var fileBody = fs.readFileSync(filePath)
    var clean = fileBody.toString().replace(/`/g, "\\`")

    var localPath = filePath.slice(codeHome.length + 1)
    body += `window.FakeFS.addFile("${localPath}", \`${clean}\`)\n`
  })

  body += `
}())
`

  fs.writeFileSync(fileName, body)
}

writeTo("../lib/core/**/*.lang", "Core", "core.js")
writeTo("../lib/stdlib/**/*.lang", "StdLib", "stdlib.js")
writeTo("../spec/**/*", "SystemSpecs", "specs.js")
