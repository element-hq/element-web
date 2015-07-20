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

var React = require('react');

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");
var MessageComposerController = require("../../../../src/controllers/molecules/MessageComposer");
var ContentMessages = require("../../../../src/ContentMessages");

module.exports = React.createClass({
    displayName: 'MessageComposer',
    mixins: [MessageComposerController],

    onUploadClick(ev) {
        //this.refs.uploadInput.getDOMNode.
    },

    onUploadFileSelected: function(ev) {
        var files = ev.target.files;

        ContentMessages.sendContentToRoom(
            files[0], this.props.room.roomId, MatrixClientPeg.get()
        ).progress(function(ev) {
            //console.log("Upload: "+ev.loaded+" / "+ev.total);
        }).done(undefined, function() {
            // display error message
        });
    },

    render: function() {
        var me = this.props.room.getMember(MatrixClientPeg.get().credentials.userId);
        var uploadInputStyle = {display: 'block'};
        return (
            <div className="mx_MessageComposer">
                <div className="mx_MessageComposer_wrapper">
                    <div className="mx_MessageComposer_row">
                        <div className="mx_MessageComposer_avatar">
                            <img src={ MatrixClientPeg.get().getAvatarUrlForMember(me, 40, 40, "crop") } width="40" height="40" alt=""/>
                        </div>
                        <div className="mx_MessageComposer_input">
                            <textarea ref="textarea" onKeyDown={this.onKeyDown} placeholder="Type a message" />
                        </div>
                        <div className="mx_MessageComposer_upload" onClick={this.onUploadClick}>
                            <img src="img/upload.png" width="32" height="32"/>
                            <input type="file" style={uploadInputStyle} ref="uploadInput" onChange={this.onUploadFileSelected} />
                        </div>
                    </div>
                </div>
            </div>
        );
    },
});

