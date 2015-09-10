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

var ComponentBroker = function() {
    this.components = {};
};

ComponentBroker.prototype = {
    get: function(name) {
        if (this.components[name]) {
            return this.components[name];
        }
        return null;
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

