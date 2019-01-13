/**
 * A very simple in-memory hash that treats keys as file paths and their values
 * as the file content. This is used to take our core, standard library, and language
 * specs and package them up into a format the web tools can use
 */
class FakeFS {
  constructor() {
    this.files = new Map()
  }

  all(pathPrefix) {
    var toReturn = new Map()

    this.files.forEach((content, path) => {
      if(path.startsWith(pathPrefix)) {
        toReturn.set(path, content)
      }
    })

    return toReturn
  }

  get(path) {
    return this.files.get(path)
  }

  addFile(path, content) {
    this.files.set(path, content)
  }
}

window.FakeFS = new FakeFS()
