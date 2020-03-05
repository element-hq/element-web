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

import React from "react";
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {Key} from "../../../Keyboard";
import * as sdk from "../../../index";

// XXX: This component is not cross-signing aware.
// https://github.com/vector-im/riot-web/issues/11752 tracks either updating this
// component or taking it out to pasture.
export default createReactClass({
    displayName: 'EncryptedEventDialog',

    propTypes: {
        event: PropTypes.object.isRequired,
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return { device: null };
    },

    componentWillMount: function() {
        this._unmounted = false;
        const client = MatrixClientPeg.get();

        // first try to load the device from our store.
        //
        this.refreshDevice().then((dev) => {
            if (dev) {
                return dev;
            }

            // tell the client to try to refresh the device list for this user
            return client.downloadKeys([this.props.event.getSender()], true).then(() => {
                return this.refreshDevice();
            });
        }).then((dev) => {
            if (this._unmounted) {
                return;
            }

            this.setState({ device: dev });
            client.on("deviceVerificationChanged", this.onDeviceVerificationChanged);
        }, (err)=>{
            console.log("Error downloading devices", err);
        });
    },

    componentWillUnmount: function() {
        this._unmounted = true;
        const client = MatrixClientPeg.get();
        if (client) {
            client.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
        }
    },

    refreshDevice: function() {
        // Promise.resolve to handle transition from static result to promise; can be removed
        // in future
        return Promise.resolve(MatrixClientPeg.get().getEventSenderDeviceInfo(this.props.event));
    },

    onDeviceVerificationChanged: function(userId, device) {
        if (userId == this.props.event.getSender()) {
            this.refreshDevice().then((dev) => {
                this.setState({ device: dev });
            });
        }
    },

    onKeyDown: function(e) {
        if (e.key === Key.ESCAPE) {
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        }
    },

    _renderDeviceInfo: function() {
        const device = this.state.device;
        if (!device) {
            return (<i>{ _t('unknown device') }</i>);
        }

        let verificationStatus = (<b>{ _t('NOT verified') }</b>);
        if (device.isBlocked()) {
            verificationStatus = (<b>{ _t('Blacklisted') }</b>);
        } else if (device.isVerified()) {
            verificationStatus = _t('verified');
        }

        return (
            <table>
                <tbody>
                    <tr>
                        <td>{ _t('Name') }</td>
                        <td>{ device.getDisplayName() }</td>
                    </tr>
                    <tr>
                        <td>{ _t('Device ID') }</td>
                        <td><code>{ device.deviceId }</code></td>
                    </tr>
                    <tr>
                        <td>{ _t('Verification') }</td>
                        <td>{ verificationStatus }</td>
                    </tr>
                    <tr>
                        <td>{ _t('Ed25519 fingerprint') }</td>
                        <td><code>{ device.getFingerprint() }</code></td>
                    </tr>
                </tbody>
            </table>
        );
    },

    _renderEventInfo: function() {
        const event = this.props.event;

        return (
            <table>
                <tbody>
                    <tr>
                        <td>{ _t('User ID') }</td>
                        <td>{ event.getSender() }</td>
                    </tr>
                    <tr>
                        <td>{ _t('Curve25519 identity key') }</td>
                        <td><code>{ event.getSenderKey() || <i>{ _t('none') }</i> }</code></td>
                    </tr>
                    <tr>
                        <td>{ _t('Claimed Ed25519 fingerprint key') }</td>
                        <td><code>{ event.getKeysClaimed().ed25519 || <i>{ _t('none') }</i> }</code></td>
                    </tr>
                    <tr>
                        <td>{ _t('Algorithm') }</td>
                        <td>{ event.getWireContent().algorithm || <i>{ _t('unencrypted') }</i> }</td>
                    </tr>
                {
                    event.getContent().msgtype === 'm.bad.encrypted' ? (
                    <tr>
                        <td>{ _t('Decryption error') }</td>
                        <td>{ event.getContent().body }</td>
                    </tr>
                    ) : null
                }
                    <tr>
                        <td>{ _t('Session ID') }</td>
                        <td><code>{ event.getWireContent().session_id || <i>{ _t('none') }</i> }</code></td>
                    </tr>
                </tbody>
            </table>
        );
    },

    render: function() {
        const DeviceVerifyButtons = sdk.getComponent('elements.DeviceVerifyButtons');

        let buttons = null;
        if (this.state.device) {
            buttons = (
                <DeviceVerifyButtons device={this.state.device}
                    userId={this.props.event.getSender()}
                />
            );
        }

        return (
            <div className="mx_EncryptedEventDialog" onKeyDown={this.onKeyDown}>
                <div className="mx_Dialog_title">
                    { _t('End-to-end encryption information') }
                </div>
                <div className="mx_Dialog_content">
                    <h4>{ _t('Event information') }</h4>
                    { this._renderEventInfo() }

                    <h4>{ _t('Sender session information') }</h4>
                    { this._renderDeviceInfo() }
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.props.onFinished} autoFocus={true}>
                        { _t('OK') }
                    </button>
                    { buttons }
                </div>
            </div>
        );
    },
});
