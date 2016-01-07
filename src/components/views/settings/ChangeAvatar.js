/*
Copyright 2015, 2016 OpenMarket Ltd

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

var React = require('react');
var MatrixClientPeg = require("../../../MatrixClientPeg");
var sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'ChangeAvatar',
    propTypes: {
        initialAvatarUrl: React.PropTypes.string,
        room: React.PropTypes.object,
        // if false, you need to call changeAvatar.onFileSelected yourself.
        showUploadSection: React.PropTypes.bool,
        className: React.PropTypes.string
    },

    Phases: {
        Display: "display",
        Uploading: "uploading",
        Error: "error",
    },

    getDefaultProps: function() {
        return {
            showUploadSection: true,
            className: "mx_Dialog_content" // FIXME - shouldn't be this by default
        };
    },

    getInitialState: function() {
        return {
            avatarUrl: this.props.initialAvatarUrl,
            phase: this.Phases.Display,
        }
    },

    componentWillReceiveProps: function(newProps) {
        if (this.avatarSet) {
            // don't clobber what the user has just set
            return;
        }
        this.setState({
            avatarUrl: newProps.initialAvatarUrl
        });
    },

    setAvatarFromFile: function(file) {
        var newUrl = null;

        this.setState({
            phase: this.Phases.Uploading
        });
        var self = this;
        var httpPromise = MatrixClientPeg.get().uploadContent(file).then(function(url) {
            newUrl = url;
            if (self.props.room) {
                return MatrixClientPeg.get().sendStateEvent(
                    self.props.room.roomId,
                    'm.room.avatar',
                    {url: url},
                    ''
                );
            } else {
                return MatrixClientPeg.get().setAvatarUrl(url);
            }
        });

        httpPromise.done(function() {
            self.setState({
                phase: self.Phases.Display,
                avatarUrl: MatrixClientPeg.get().mxcUrlToHttp(newUrl)
            });
        }, function(error) {
            self.setState({
                phase: self.Phases.Error
            });
            self.onError(error);
        });

        return httpPromise;
    },

    onFileSelected: function(ev) {
        this.avatarSet = true;
        return this.setAvatarFromFile(ev.target.files[0]);
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

        var uploadSection;
        if (this.props.showUploadSection) {
            uploadSection = (
                <div className={this.props.className}>
                    Upload new:
                    <input type="file" onChange={this.onFileSelected}/>
                    {this.state.errorText}
                </div>  
            );
        }

        switch (this.state.phase) {
            case this.Phases.Display:
            case this.Phases.Error:
                return (
                    <div>
                        <div className={this.props.className}>
                            {avatarImg}
                        </div>
                        {uploadSection}
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
