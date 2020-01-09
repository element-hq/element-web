/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import PropTypes from 'prop-types';
import * as sdk from "../../../index";
import { _t } from '../../../languageHandler';
import Modal from "../../../Modal";
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import {verificationMethods} from 'matrix-js-sdk/src/crypto';
import KeyVerificationStateObserver, {userLabelForEventRoom} from "../../../utils/KeyVerificationStateObserver";
import dis from "../../../dispatcher";

export default class VerificationRequestToast extends React.PureComponent {
    constructor(props) {
        super(props);
        const {event, timeout} = props.request;
        // to_device requests don't have a timestamp, so consider them age=0
        const age = event.getTs() ? event.getLocalAge() : 0;
        const remaining = Math.max(0, timeout - age);
        const counter = Math.ceil(remaining / 1000);
        this.state = {counter};
        if (this.props.requestObserver) {
            this.props.requestObserver.setCallback(this._checkRequestIsPending);
        }
    }

    componentDidMount() {
        if (this.props.requestObserver) {
            this.props.requestObserver.attach();
            this._checkRequestIsPending();
        }
        this._intervalHandle = setInterval(() => {
            let {counter} = this.state;
            counter -= 1;
            if (counter <= 0) {
                this.cancel();
            } else {
                this.setState({counter});
            }
        }, 1000);
    }

    componentWillUnmount() {
        clearInterval(this._intervalHandle);
        if (this.props.requestObserver) {
            this.props.requestObserver.detach();
        }
    }

    _checkRequestIsPending = () => {
        if (!this.props.requestObserver.pending) {
            this.props.dismiss();
        }
    }

    cancel = () => {
        this.props.dismiss();
        try {
            this.props.request.cancel();
        } catch (err) {
            console.error("Error while cancelling verification request", err);
        }
    }

    accept = () => {
        this.props.dismiss();
        const {event} = this.props.request;
        // no room id for to_device requests
        if (event.getRoomId()) {
            dis.dispatch({
                action: 'view_room',
                room_id: event.getRoomId(),
                should_peek: false,
            });
        }

        const verifier = this.props.request.beginKeyVerification(verificationMethods.SAS);
        const IncomingSasDialog = sdk.getComponent('views.dialogs.IncomingSasDialog');
        Modal.createTrackedDialog('Incoming Verification', '', IncomingSasDialog, {
            verifier,
        }, null, /* priority = */ false, /* static = */ true);
    };

    render() {
        const FormButton = sdk.getComponent("elements.FormButton");
        const {event} = this.props.request;
        const userId = event.getSender();
        let nameLabel = event.getRoomId() ? userLabelForEventRoom(userId, event) : userId;
        // for legacy to_device verification requests
        if (nameLabel === userId) {
            const client = MatrixClientPeg.get();
            const user = client.getUser(event.getSender());
            if (user && user.displayName) {
                nameLabel = _t("%(name)s (%(userId)s)", {name: user.displayName, userId});
            }
        }
        return (<div>
            <div className="mx_Toast_description">{nameLabel}</div>
            <div className="mx_Toast_buttons" aria-live="off">
                <FormButton label={_t("Decline (%(counter)s)", {counter: this.state.counter})} kind="danger" onClick={this.cancel} />
                <FormButton label={_t("Accept")} onClick={this.accept} />
            </div>
        </div>);
    }
}

VerificationRequestToast.propTypes = {
    dismiss: PropTypes.func.isRequired,
    request: PropTypes.object.isRequired,
    requestObserver: PropTypes.instanceOf(KeyVerificationStateObserver),
};
