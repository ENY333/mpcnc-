const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const main = require.resolve('../desktop/main.cjs');
const events = {};
let options, loaded, openHandler, navigation, permissionHandler, menu;
const electron = {
  app: {whenReady: () => ({then: callback => callback()}), on: (event, callback) => {events[event] = callback;}, quit: () => {}},
  Menu: {setApplicationMenu: value => {menu = value;}},
  BrowserWindow: class {
    constructor(config) {
      options = config;
      this.webContents = {
        setWindowOpenHandler: handler => {openHandler = handler;},
        on: (event, handler) => {if(event === 'will-navigate') navigation = handler;},
        session: {setPermissionRequestHandler: handler => {permissionHandler = handler;}}
      };
    }
    loadFile(file) {loaded = file;}
  }
};
vm.runInNewContext(fs.readFileSync(main, 'utf8'), {
  require: name => name === 'electron' ? electron : require(name),
  __dirname: path.dirname(main), process: {platform: 'win32'}
});
assert.equal(options.webPreferences.nodeIntegration, false);
assert.equal(options.webPreferences.contextIsolation, true);
assert.equal(options.webPreferences.sandbox, true);
assert.equal(options.webPreferences.webSecurity, true);
assert.equal(loaded, path.resolve(__dirname, '../index.html'));
assert.equal(openHandler().action, 'deny');
let blocked = false;
navigation({preventDefault: () => {blocked = true;}});
assert.equal(blocked, true);
permissionHandler(null, 'camera', result => assert.equal(result, false));
assert.equal(menu, null);
assert.equal(typeof events['window-all-closed'], 'function');
console.log('PASS: desktop window loads local app with isolated renderer and blocks navigation, popups and permission requests');
