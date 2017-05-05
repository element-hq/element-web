/*
Copyright 2017 Vector Creations Ltd

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

// singleton which dispatches invocations of a given type & argument
// rather than just a type (as per EventEmitter and Flux's dispatcher etc)
//
// This means you can have a single point which listens for an EventEmitter event
// and then dispatches out to one of thousands of RoomTiles (for instance) rather than
// having each RoomTile register for the EventEmitter event and having to 
// iterate over all of them.
class ConstantTimeDispatcher {
    constructor() {
        // type -> arg -> [ listener(arg, params) ]
        this.listeners = {};
    }

    register(type, arg, listener) {
        if (!this.listeners[type]) this.listeners[type] = {};
        if (!this.listeners[type][arg]) this.listeners[type][arg] = [];
        this.listeners[type][arg].push(listener);
    }

    unregister(type, arg, listener) {
        if (this.listeners[type] && this.listeners[type][arg]) {
            var i = this.listeners[type][arg].indexOf(listener);
            if (i > -1) {
                this.listeners[type][arg].splice(i, 1);
            }
        }
        else {
            console.warn("Unregistering unrecognised listener (type=" + type + ", arg=" + arg + ")");
        }
    }

    dispatch(type, arg, params) {
        if (!this.listeners[type] || !this.listeners[type][arg]) {
            //console.warn("No registered listeners for dispatch (type=" + type + ", arg=" + arg + ")");
            return;
        }
        this.listeners[type][arg].forEach(listener=>{
            listener.call(arg, params);
        });
    }
}

if (!global.constantTimeDispatcher) {
    global.constantTimeDispatcher = new ConstantTimeDispatcher();
}
module.exports = global.constantTimeDispatcher;
