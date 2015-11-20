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

var sdk = require('matrix-react-sdk');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'PostRegistration',

    propTypes: {
        onComplete: React.PropTypes.func.isRequired
    },

    getInitialState: function() {
        return {
            avatarUrl: null,
            errorString: null,
            busy: false
        };
    },

    componentWillMount: function() {
        // There is some assymetry between ChangeDisplayName and ChangeAvatar,
        // as ChangeDisplayName will auto-get the name but ChangeAvatar expects
        // the URL to be passed to you (because it's also used for room avatars).
        var cli = MatrixClientPeg.get();
        this.setState({busy: true});
        var self = this;
        cli.getProfileInfo(cli.credentials.userId).done(function(result) {
            self.setState({
                avatarUrl: MatrixClientPeg.get().mxcUrlToHttp(result.avatar_url),
                busy: false
            });
        }, function(error) {
            self.setState({
                errorString: "Failed to fetch avatar URL",
                busy: false
            });
        });
    },

    render: function() {
        var ChangeDisplayName = sdk.getComponent('molecules.ChangeDisplayName');
        var ChangeAvatar = sdk.getComponent('molecules.ChangeAvatar');
        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <div className="mx_Login_logo">
                        <img src="img/logo.png" width="249" height="78" alt="vector"/>
                    </div>
                    <div className="mx_Login_profile">
                        Set a display name:
                        <ChangeDisplayName />
                        Upload an avatar:
                        <ChangeAvatar
                            initialAvatarUrl={this.state.avatarUrl} />
                        <button onClick={this.props.onComplete}>Continue</button>
                        {this.state.errorString}
                    </div>
                </div>
            </div>
        );
    }
});
