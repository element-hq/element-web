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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import classnames from 'classnames';
import { Key } from '../../../Keyboard';
import { _t } from '../../../languageHandler';
import { SAFE_LOCALPART_REGEX } from '../../../Registration';

// The amount of time to wait for further changes to the input username before
// sending a request to the server
const USERNAME_CHECK_DEBOUNCE_MS = 250;

/*
 * Prompt the user to set a display name.
 *
 * On success, `onFinished(true, newDisplayName)` is called.
 */
export default class SetMxIdDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        // Called when the user requests to register with a different homeserver
        onDifferentServerClicked: PropTypes.func.isRequired,
        // Called if the user wants to switch to login instead
        onLoginClick: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this._input_value = createRef();
        this._uiAuth = createRef();

        this.state = {
            // The entered username
            username: '',
            // Indicate ongoing work on the username
            usernameBusy: false,
            // Indicate error with username
            usernameError: '',
            // Assume the homeserver supports username checking until "M_UNRECOGNIZED"
            usernameCheckSupport: true,

            // Whether the auth UI is currently being used
            doingUIAuth: false,
            // Indicate error with auth
            authError: '',
        };
    }

    componentDidMount() {
        this._input_value.current.select();

        this._matrixClient = MatrixClientPeg.get();
    }

    onValueChange = ev => {
        this.setState({
            username: ev.target.value,
            usernameBusy: true,
            usernameError: '',
        }, () => {
            if (!this.state.username || !this.state.usernameCheckSupport) {
                this.setState({
                    usernameBusy: false,
                });
                return;
            }

            // Debounce the username check to limit number of requests sent
            if (this._usernameCheckTimeout) {
                clearTimeout(this._usernameCheckTimeout);
            }
            this._usernameCheckTimeout = setTimeout(() => {
                this._doUsernameCheck().finally(() => {
                    this.setState({
                        usernameBusy: false,
                    });
                });
            }, USERNAME_CHECK_DEBOUNCE_MS);
        });
    };

    onKeyUp = ev => {
        if (ev.key === Key.ENTER) {
            this.onSubmit();
        }
    };

    onSubmit = ev => {
        if (this._uiAuth.current) {
            this._uiAuth.current.tryContinue();
        }
        this.setState({
            doingUIAuth: true,
        });
    };

    _doUsernameCheck() {
        // We do a quick check ahead of the username availability API to ensure the
        // user ID roughly looks okay from a Matrix perspective.
        if (!SAFE_LOCALPART_REGEX.test(this.state.username)) {
            this.setState({
                usernameError: _t("A username can only contain lower case letters, numbers and '=_-./'"),
            });
            return Promise.reject();
        }

        // Check if username is available
        return this._matrixClient.isUsernameAvailable(this.state.username).then(
            (isAvailable) => {
                if (isAvailable) {
                    this.setState({usernameError: ''});
                }
            },
            (err) => {
                // Indicate whether the homeserver supports username checking
                const newState = {
                    usernameCheckSupport: err.errcode !== "M_UNRECOGNIZED",
                };
                console.error('Error whilst checking username availability: ', err);
                switch (err.errcode) {
                    case "M_USER_IN_USE":
                        newState.usernameError = _t('Username not available');
                        break;
                    case "M_INVALID_USERNAME":
                        newState.usernameError = _t(
                            'Username invalid: %(errMessage)s',
                            { errMessage: err.message},
                        );
                        break;
                    case "M_UNRECOGNIZED":
                        // This homeserver doesn't support username checking, assume it's
                        // fine and rely on the error appearing in registration step.
                        newState.usernameError = '';
                        break;
                    case undefined:
                        newState.usernameError = _t('Something went wrong!');
                        break;
                    default:
                        newState.usernameError = _t(
                            'An error occurred: %(error_string)s',
                            { error_string: err.message },
                        );
                        break;
                }
                this.setState(newState);
            },
        );
    }

    _generatePassword() {
        return Math.random().toString(36).slice(2);
    }

    _makeRegisterRequest = auth => {
        // Not upgrading - changing mxids
        const guestAccessToken = null;
        if (!this._generatedPassword) {
            this._generatedPassword = this._generatePassword();
        }
        return this._matrixClient.register(
            this.state.username,
            this._generatedPassword,
            undefined, // session id: included in the auth dict already
            auth,
            {},
            guestAccessToken,
        );
    };

    _onUIAuthFinished = (success, response) => {
        this.setState({
            doingUIAuth: false,
        });

        if (!success) {
            this.setState({ authError: response.message });
            return;
        }

        this.props.onFinished(true, {
            userId: response.user_id,
            deviceId: response.device_id,
            homeserverUrl: this._matrixClient.getHomeserverUrl(),
            identityServerUrl: this._matrixClient.getIdentityServerUrl(),
            accessToken: response.access_token,
            password: this._generatedPassword,
        });
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const InteractiveAuth = sdk.getComponent('structures.InteractiveAuth');

        let auth;
        if (this.state.doingUIAuth) {
            auth = <InteractiveAuth
                matrixClient={this._matrixClient}
                makeRequest={this._makeRegisterRequest}
                onAuthFinished={this._onUIAuthFinished}
                inputs={{}}
                poll={true}
                ref={this._uiAuth}
                continueIsManaged={true}
            />;
        }
        const inputClasses = classnames({
            "mx_SetMxIdDialog_input": true,
            "error": Boolean(this.state.usernameError),
        });

        let usernameIndicator = null;
        if (this.state.usernameBusy) {
            usernameIndicator = <div>{_t("Checking...")}</div>;
        } else {
            const usernameAvailable = this.state.username &&
                this.state.usernameCheckSupport && !this.state.usernameError;
            const usernameIndicatorClasses = classnames({
                "error": Boolean(this.state.usernameError),
                "success": usernameAvailable,
            });
            usernameIndicator = <div className={usernameIndicatorClasses} role="alert">
                { usernameAvailable ? _t('Username available') : this.state.usernameError }
            </div>;
        }

        let authErrorIndicator = null;
        if (this.state.authError) {
            authErrorIndicator = <div className="error" role="alert">
                { this.state.authError }
            </div>;
        }
        const canContinue = this.state.username &&
            !this.state.usernameError &&
            !this.state.usernameBusy;

        return (
            <BaseDialog className="mx_SetMxIdDialog"
                onFinished={this.props.onFinished}
                title={_t('To get started, please pick a username!')}
                contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    <div className="mx_SetMxIdDialog_input_group">
                        <input type="text" ref={this._input_value} value={this.state.username}
                            autoFocus={true}
                            onChange={this.onValueChange}
                            onKeyUp={this.onKeyUp}
                            size="30"
                            className={inputClasses}
                        />
                    </div>
                    { usernameIndicator }
                    <p>
                        { _t(
                            'This will be your account name on the <span></span> ' +
                            'homeserver, or you can pick a <a>different server</a>.',
                            {},
                            {
                                'span': <span>{ this.props.homeserverUrl }</span>,
                                'a': (sub) => <a href="#" onClick={this.props.onDifferentServerClicked}>{ sub }</a>,
                            },
                        ) }
                    </p>
                    <p>
                        { _t(
                            'If you already have a Matrix account you can <a>log in</a> instead.',
                            {},
                            { 'a': (sub) => <a href="#" onClick={this.props.onLoginClick}>{ sub }</a> },
                        ) }
                    </p>
                    { auth }
                    { authErrorIndicator }
                </div>
                <div className="mx_Dialog_buttons">
                    <input className="mx_Dialog_primary"
                        type="submit"
                        value={_t("Continue")}
                        onClick={this.onSubmit}
                        disabled={!canContinue}
                    />
                </div>
            </BaseDialog>
        );
    }
}
