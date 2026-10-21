const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(file, dependencies = {}) {
  const filename = path.resolve(__dirname, '../..', file);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, process, console, Buffer, URL, URLSearchParams,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      return require(name.startsWith('.') ? path.resolve(path.dirname(filename), name) : name);
    }
  }, { filename });
  return module.exports;
}
module.exports = { load };
