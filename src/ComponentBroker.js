var components = {};

function load(name) {
    var module = require("./views/"+name);
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
require('./views/atoms/LogoutButton');
require('./views/atoms/MessageTimestamp');
require('./views/molecules/MatrixToolbar');
require('./views/molecules/RoomTile');
require('./views/molecules/MessageTile');
require('./views/molecules/SenderProfile');
require('./views/molecules/UnknownMessageTile');
require('./views/molecules/MTextTile');
require('./views/molecules/MNoticeTile');
require('./views/molecules/MEmoteTile');
require('./views/molecules/RoomHeader');
require('./views/molecules/MessageComposer');
require('./views/molecules/ProgressBar');
require('./views/molecules/ServerConfig');
require('./views/organisms/MemberList');
require('./views/molecules/MemberTile');
require('./views/organisms/RoomList');
require('./views/organisms/RoomView');
require('./views/templates/Login');
