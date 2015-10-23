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

var React = require('react');
var MatrixClientPeg = require("../../MatrixClientPeg");

module.exports = {
    propTypes: {
        initialAvatarUrl: React.PropTypes.string,
        room: React.PropTypes.object,
    },

    Phases: {
        Display: "display",
        Uploading: "uploading",
        Error: "error",
    },

    getInitialState: function() {
        return {
            avatarUrl: this.props.initialAvatarUrl,
            phase: this.Phases.Display,
        }
    },

    setAvatarFromFile: function(file) {
        var newUrl = null;

        this.setState({
            phase: this.Phases.Uploading
        });
        var self = this;
        MatrixClientPeg.get().uploadContent(file).then(function(url) {
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
        }).done(function() {
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
    },
}
