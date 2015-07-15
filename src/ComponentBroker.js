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

function load(name) {
    var module = require("../skins/base/views/"+name);
    return module;
};

var ComponentBroker = function() {
    this.components = {};
};

ComponentBroker.prototype = {
    get: function(name) {
        if (this.components[name]) {
            return this.components[name];
        }

        this.components[name] = load(name);
        return this.components[name];
    },

    set: function(name, module) {
        this.components[name] = module;
    }
};

// We define one Component Broker globally, because the intention is
// very much that it is a singleton. Relying on there only being one
// copy of the module can be dicey and not work as browserify's
// behaviour with multiple copies of files etc. is erratic at best.
// XXX: We can still end up with the same file twice in the resulting
// JS bundle which is nonideal.
if (global.componentBroker === undefined) {
    global.componentBroker = new ComponentBroker();
}
module.exports = global.componentBroker;

// We need to tell browserify to include all the components
// by direct require syntax in here, but we don't want them
// to be evaluated in this file because then we wouldn't be
// able to override them. if (0) does this.
// Must be in this file (because the require is file-specific) and
// must be at the end because the components include this file.
if (0) {
require('../skins/base/views/atoms/LogoutButton');
require('../skins/base/views/atoms/EnableNotificationsButton');
require('../skins/base/views/atoms/MessageTimestamp');
require('../skins/base/views/atoms/create_room/CreateRoomButton');
require('../skins/base/views/atoms/create_room/RoomNameTextbox');
require('../skins/base/views/atoms/create_room/Presets');
require('../skins/base/views/atoms/EditableText');
require('../skins/base/views/molecules/MatrixToolbar');
require('../skins/base/views/molecules/RoomTile');
require('../skins/base/views/molecules/MessageTile');
require('../skins/base/views/molecules/SenderProfile');
require('../skins/base/views/molecules/UnknownMessageTile');
require('../skins/base/views/molecules/MTextTile');
require('../skins/base/views/molecules/MNoticeTile');
require('../skins/base/views/molecules/MEmoteTile');
require('../skins/base/views/molecules/MImageTile');
require('../skins/base/views/molecules/MFileTile');
require('../skins/base/views/molecules/MRoomMemberTile');
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
require('../skins/base/views/organisms/CreateRoom');
require('../skins/base/views/molecules/UserSelector');
// new for vector
require('../skins/base/views/organisms/LeftPanel');
require('../skins/base/views/organisms/RightPanel');
require('../skins/base/views/molecules/RoomCreate');
require('../skins/base/views/molecules/RoomDropTarget');
require('../skins/base/views/molecules/DirectoryMenu');
require('../skins/base/views/atoms/voip/VideoFeed');
require('../skins/base/views/molecules/voip/VideoView');


}
