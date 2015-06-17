var components = {};

function load(name) {
    var module = require("./"+name);
    components[name] = module;
    return module;
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

// Statically require all the components we know about,
// otherwise browserify has no way of knowing what module to include
// Must be in this file (because the require is file-specific) and
// must be at the end because the components include this file.
require('./atoms/LogoutButton');
require('./atoms/MessageTimestamp');
require('./molecules/MatrixToolbar');
require('./molecules/RoomTile');
require('./molecules/MessageTile');
require('./molecules/SenderProfile');
require('./molecules/UnknownMessageTile');
require('./molecules/MTextTile');
require('./molecules/MEmoteTile');
require('./molecules/RoomHeader');
require('./molecules/MessageComposer');
require('./organisms/RoomList');
require('./organisms/RoomView');
require('./templates/Login');
