var components = {};

function load(name) {
    var types = [
        'atoms',
        'molecules',
        'organisms',
        'templates',
        'pages'
    ];
    var ex = null;
    for (var i = 0; i < types.length; ++i) {
        try {
            var module = require("./"+types[i]+"/"+name);
            components[name] = module;
            return module;
        } catch (err) {
            ex = err;
        }
    }
    throw ex;
};

module.exports = {
    get: function(name) {
        if (components[name]) return components[name];

        components[name] = load(name);
        return components[name];
    },

    set: function(name, module) {
        components[name] = module;
    }
};

require('./organisms/RoomList');
require('./organisms/RoomView');
require('./molecules/MatrixToolbar');
require('./templates/Login');
