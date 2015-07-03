/*
Copyright 2015 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

var components = {};

function load(name) {
    var module = require("../skins/base/views/"+name);
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
require('../skins/base/views/atoms/LogoutButton');
require('../skins/base/views/atoms/EnableNotificationsButton');
require('../skins/base/views/atoms/MessageTimestamp');
require('../skins/base/views/molecules/MatrixToolbar');
require('../skins/base/views/molecules/RoomTile');
require('../skins/base/views/molecules/MessageTile');
require('../skins/base/views/molecules/SenderProfile');
require('../skins/base/views/molecules/UnknownMessageTile');
require('../skins/base/views/molecules/MTextTile');
require('../skins/base/views/molecules/MNoticeTile');
require('../skins/base/views/molecules/MEmoteTile');
require('../skins/base/views/molecules/RoomHeader');
require('../skins/base/views/molecules/MessageComposer');
require('../skins/base/views/molecules/ProgressBar');
require('../skins/base/views/molecules/ServerConfig');
require('../skins/base/views/organisms/MemberList');
require('../skins/base/views/molecules/MemberTile');
require('../skins/base/views/organisms/RoomList');
require('../skins/base/views/organisms/RoomView');
require('../skins/base/views/templates/Login');
require('../skins/base/views/organisms/Notifier');
