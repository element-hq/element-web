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

var dis = require("../../dispatcher");
var Modal = require("../../Modal");
var sdk = require('../../index.js');

var MatrixClientPeg = require("../../MatrixClientPeg");

module.exports = {
    getInitialState: function() {
        return {};
    },

    onLeaveClick: function() {
        var QuestionDialog = sdk.getComponent("organisms.QuestionDialog");

        var roomId = this.props.member.roomId;
        Modal.createDialog(QuestionDialog, {
            title: "Leave room",
            description: "Are you sure you want to leave the room?",
            onFinished: function(should_leave) {
                if (should_leave) {
                    var d = MatrixClientPeg.get().leave(roomId);

                    // FIXME: controller shouldn't be loading a view :(
                    var Loader = sdk.getComponent("elements.Spinner");
                    var modal = Modal.createDialog(Loader);

                    d.then(function() {
                        modal.close();
                        dis.dispatch({action: 'view_next_room'});
                    }, function(err) {
                        modal.close();
                        Modal.createDialog(ErrorDialog, {
                            title: "Failed to leave room",
                            description: err.toString()
                        });
                    });
                }
            }
        });
    }
};
