/*
Copyright 2016 OpenMarket Ltd
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

import q from 'q';
import React from 'react';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';

/**
 * Prompt the user to set a display name.
 *
 * On success, `onFinished(true, newDisplayName)` is called.
 */
export default React.createClass({
    displayName: 'SetMxIdDialog',
    propTypes: {
        onFinished: React.PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            username : '',
            doingUIAuth: false,
        }
    },

    componentDidMount: function() {
        this.refs.input_value.select();

        this._matrixClient = MatrixClientPeg.get();
    },

    onValueChange: function(ev) {
        this.setState({
            username: ev.target.value
        });
    },

    onSubmit: function(ev) {
        this.setState({
            doingUIAuth: true,
        });
    },

    _generatePassword: function() {
        return Math.random().toString(36).slice(2);
    },

    _makeRegisterRequest: function(auth) {
        // Not upgrading - changing mxids
        const guestAccessToken = null;
        this._generatedPassword = this._generatePassword();

        return this._matrixClient.register(
            this.state.username,
            this._generatedPassword,
            undefined, // session id: included in the auth dict already
            auth,
            {},
            guestAccessToken,
        );
    },

    _onUIAuthFinished: function(success, response) {
        this.setState({
            doingUIAuth: false,
        });
        console.info('Auth Finsihed', arguments);

        if (!success) {
            this.setState({ errorText : response.message });
            return;
        }

        // XXX Implement RTS /register here
        const teamToken = null;

        this.props.onFinished(true, {
            userId: response.user_id,
            deviceId: response.device_id,
            homeserverUrl: this._matrixClient.getHomeserverUrl(),
            identityServerUrl: this._matrixClient.getIdentityServerUrl(),
            accessToken: response.access_token,
            password: this._generatedPassword,
            teamToken: teamToken,
        });
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const InteractiveAuth = sdk.getComponent('structures.InteractiveAuth');
        const Spinner = sdk.getComponent('elements.Spinner');
        let auth;
        if (this.state.doingUIAuth) {
            auth = <InteractiveAuth
                matrixClient={this._matrixClient}
                makeRequest={this._makeRegisterRequest}
                onAuthFinished={this._onUIAuthFinished}
                inputs={{}}
                poll={true}
            />;
        }
        return (
            <BaseDialog className="mx_SetMxIdDialog"
                onFinished={this.props.onFinished}
                title="Choose a Username"
            >
                <div className="mx_Dialog_content">
                    <p>
                        Beyond this point you're going to need to pick a username - your
                        unique identifier in Riot.
                    </p>
                    <p>
                        <small>
                            You can't change your username, but you can always choose how you
                            appear to other people in Riot by changing your display name.
                        </small>
                    </p>
                    <input type="text" ref="input_value" value={this.state.username}
                        autoFocus={true} onChange={this.onValueChange} size="30"
                        className="mx_SetMxIdDialog_input"
                    />
                    { auth }
                    <div>
                        { this.state.errorText }
                    </div>
                </div>
                <div className="mx_Dialog_buttons">
                    <input className="mx_Dialog_primary"
                        type="submit"
                        value="Continue"
                        onClick={this.onSubmit}
                    />
                </div>
            </BaseDialog>
        );
    },
});
