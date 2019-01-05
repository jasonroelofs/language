#!/usr/bin/env node

// This script packages up our core and standard libraries into a JSON
// object that can be pulled in on the web.
// There's probably a way to hook this into webpack proper so it doesn't
// need to be two steps but couldn't find anything specific at this time.

var path = require("path")
var fs = require("fs")
var glob = require("fast-glob")

var here = path.resolve(__dirname)
var coreLib = path.resolve(here, "../lib/core")
var stdLib = path.resolve(here, "../lib/stdlib")

var coreFiles = glob.sync([`${coreLib}/**/*.lang`])
var stdlibFiles = glob.sync([`${stdLib}/**/*.lang`])

var writeTo = function(fileList, varName, fileName) {

  var body = `
(function() {
  var files = new Map()
`

  fileList.forEach((filePath) => {
    var fileBody = fs.readFileSync(filePath)
    var clean = fileBody.toString().replace(/`/g, "\\`")

    body += `files.set("${path.basename(filePath)}", \`${clean}\`)\n`
  })

  body += `
  window.${varName} = files
}())
`

  fs.writeFileSync(fileName, body)
}

writeTo(coreFiles, "Core", "core.js")
writeTo(stdlibFiles, "StdLib", "stdlib.js")
