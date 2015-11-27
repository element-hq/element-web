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

var sdk = require('matrix-react-sdk')
var ChangeAvatarController = require('matrix-react-sdk/lib/controllers/molecules/ChangeAvatar')

module.exports = React.createClass({
    displayName: 'ChangeAvatar',
    mixins: [ChangeAvatarController],

    onFileSelected: function(ev) {
        this.avatarSet = true;
        this.setAvatarFromFile(ev.target.files[0]);
    },

    onError: function(error) {
        this.setState({
            errorText: "Failed to upload profile picture!"
        });
    },

    render: function() {
        var RoomAvatar = sdk.getComponent('avatars.RoomAvatar');
        var avatarImg;
        // Having just set an avatar we just display that since it will take a little
        // time to propagate through to the RoomAvatar.
        if (this.props.room && !this.avatarSet) {
            avatarImg = <RoomAvatar room={this.props.room} width='320' height='240' resizeMethod='scale' />;
        } else {
            var style = {
                maxWidth: 320,
                maxHeight: 240,
            };
            avatarImg = <img src={this.state.avatarUrl} style={style} />;
        }

        switch (this.state.phase) {
            case this.Phases.Display:
            case this.Phases.Error:
                return (
                    <div>
                        <div className="mx_Dialog_content">
                            {avatarImg}
                        </div>
                        <div className="mx_Dialog_content">
                            Upload new:
                            <input type="file" onChange={this.onFileSelected}/>
                            {this.state.errorText}
                        </div>    
                    </div>
                );
            case this.Phases.Uploading:
                var Loader = sdk.getComponent("elements.Spinner");
                return (
                    <Loader />
                );
        }
    }
});
