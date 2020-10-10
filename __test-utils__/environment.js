const BaseEnvironment = require("jest-environment-jsdom-sixteen");

class Environment extends BaseEnvironment {
    constructor(config, options) {
        super(Object.assign({}, config, {
            globals: Object.assign({}, config.globals, {
                // Explicitly specify the correct globals to workaround Jest bug
                // https://github.com/facebook/jest/issues/7780
                Uint32Array: Uint32Array,
                Uint8Array: Uint8Array,
                ArrayBuffer: ArrayBuffer,
            }),
        }), options);
    }
}

module.exports = Environment;
