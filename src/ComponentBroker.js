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
    var module = require("../themes/base/views/"+name);
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
require('../themes/base/views/atoms/LogoutButton');
require('../themes/base/views/atoms/MessageTimestamp');
require('../themes/base/views/molecules/MatrixToolbar');
require('../themes/base/views/molecules/RoomTile');
require('../themes/base/views/molecules/MessageTile');
require('../themes/base/views/molecules/SenderProfile');
require('../themes/base/views/molecules/UnknownMessageTile');
require('../themes/base/views/molecules/MTextTile');
require('../themes/base/views/molecules/MNoticeTile');
require('../themes/base/views/molecules/MEmoteTile');
require('../themes/base/views/molecules/RoomHeader');
require('../themes/base/views/molecules/MessageComposer');
require('../themes/base/views/molecules/ProgressBar');
require('../themes/base/views/molecules/ServerConfig');
require('../themes/base/views/organisms/MemberList');
require('../themes/base/views/molecules/MemberTile');
require('../themes/base/views/organisms/RoomList');
require('../themes/base/views/organisms/RoomView');
require('../themes/base/views/templates/Login');
