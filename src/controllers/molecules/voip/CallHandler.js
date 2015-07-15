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

var dis = require("../../../dispatcher");

module.exports = {

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        // if we were given a room_id to track, don't handle anything else.
        if (payload.room_id && this.props.room && 
                this.props.room.roomId !== payload.room_id) {
            return;
        }

        switch (payload.action) {
            case 'place_call':
                console.log("Place %s call in %s", payload.type, payload.room_id);
                break;
            case 'incoming_call':
                console.log("Incoming call: %s", payload.call);
                break;
        }
    }
};

