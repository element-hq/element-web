/*
Copyright 2016 OpenMarket Ltd

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

import React from 'react';
import q from 'q';

import dis from '../../../dispatcher';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import Lifecycle from '../../../Lifecycle';

/**
 * A react component which is only used when the application first starts.
 *
 * Its job is to attempt to build a logged-in Matrix session. It tries a number
 * of things:
 *
 * 0. if it looks like we are in the middle of a registration process, it does
 *    nothing.
 *
 * 1. if we have a guest access token in the query params, it uses that.
 *
 * 2. if an access token is stored in local storage (from a previous session),
 *    it uses that.
 *
 * 3. it attempts to auto-register as a guest user.
 *
 * If any of steps 1-3 are successful, it will call onLoggedIn (which is
 * typically Lifecycle.setLoggedIn, which in turn will raise on_logged_in and
 * will_start_client events).
 *
 * Finally, it calls onComplete, which makes MatrixChat move into its normal processing.
 */
export default class SessionLoader extends React.Component {
    constructor(props, context) {
        super(props, context);
    }

    componentDidMount() {
        this._loadSession().done(() => {
            this.props.onComplete();
        });
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.hsUrl != this.props.hsUrl ||
            nextProps.isUrl != this.props.isUrl
        ) {
            throw new Error("changing servers on a SessionLoader is not supported");
        };
    }

    _loadSession() {
        if (this.props.queryParams.client_secret && this.props.queryParams.sid) {
            // this happens during email validation: the email contains a link to the
            // IS, which in turn redirects back to vector. We let MatrixChat create a
            // Registration component which completes the next stage of registration.
            console.log("Not registering as guest: registration already in progress.");
            return q();
        }

        let enableGuest = false;
        if (this.props.enableGuest) {
            if (!this.props.hsUrl) {
                console.warn("Cannot enable guest access: can't determine HS URL to use");
            }
            else {
                enableGuest = true;
            }
        }

        if (enableGuest &&
            this.props.queryParams.guest_user_id &&
            this.props.queryParams.guest_access_token
        ) {
            console.log("Using guest access credentials");
            this.props.onLoggedIn({
                userId: this.props.queryParams.guest_user_id,
                accessToken: this.props.queryParams.guest_access_token,
                homeserverUrl: this.props.hsUrl,
                identityServerUrl: this.props.isUrl,
                guest: true,
            });
            return q();
        }

        if (MatrixClientPeg.get() && MatrixClientPeg.get().credentials) {
            console.log("Using existing credentials");
            this.props.onLoggedIn(MatrixClientPeg.getCredentials());
            return q();
        }

        if (enableGuest) {
            return this._registerAsGuest();
        }

        // fall back to login screen
        return q();
    }

    _registerAsGuest() {
        var hsUrl = this.props.hsUrl;
        var isUrl = this.props.isUrl;
        console.log("Doing guest login on %s", hsUrl);

        MatrixClientPeg.replaceUsingUrls(hsUrl, isUrl);
        return MatrixClientPeg.get().registerGuest().then((creds) => {
            console.log("Registered as guest: %s", creds.user_id);
            this.props.onLoggedIn({
                userId: creds.user_id,
                accessToken: creds.access_token,
                homeserverUrl: hsUrl,
                identityServerUrl: isUrl,
                guest: true,
            });
        }, (err) => {
            console.error("Failed to register as guest: " + err + " " + err.data);
        });
    }

    render() {
        const Spinner = sdk.getComponent('elements.Spinner');
        return (
            <div className="mx_MatrixChat_splash">
                <Spinner />
            </div>
        );
    }
}


SessionLoader.propTypes = {
    queryParams: React.PropTypes.object.isRequired,
    enableGuest: React.PropTypes.bool,
    hsUrl: React.PropTypes.string,
    isUrl: React.PropTypes.string,
    onLoggedIn: React.PropTypes.func.isRequired,
    onComplete: React.PropTypes.func.isRequired,
};
