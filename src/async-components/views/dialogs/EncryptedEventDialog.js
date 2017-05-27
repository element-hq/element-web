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

var React = require("react");
import { _t } from '../../../languageHandler';
var sdk = require('../../../index');
var MatrixClientPeg = require("../../../MatrixClientPeg");

module.exports = React.createClass({
    displayName: 'EncryptedEventDialog',

    propTypes: {
        event: React.PropTypes.object.isRequired,
        onFinished: React.PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return { device: this.refreshDevice() };
    },

    componentWillMount: function() {
        this._unmounted = false;
        var client = MatrixClientPeg.get();
        client.on("deviceVerificationChanged", this.onDeviceVerificationChanged);

        // no need to redownload keys if we already have the device
        if (this.state.device) {
            return;
        }
        client.downloadKeys([this.props.event.getSender()], true).done(()=>{
            if (this._unmounted) {
                return;
            }
            this.setState({ device: this.refreshDevice() });
        }, (err)=>{
            console.log("Error downloading devices", err);
        });
    },

    componentWillUnmount: function() {
        this._unmounted = true;
        var client = MatrixClientPeg.get();
        if (client) {
            client.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
        }
    },

    refreshDevice: function() {
        return MatrixClientPeg.get().getEventSenderDeviceInfo(this.props.event);
    },

    onDeviceVerificationChanged: function(userId, device) {
        if (userId == this.props.event.getSender()) {
            this.setState({ device: this.refreshDevice() });
        }
    },

    onKeyDown: function(e) {
        if (e.keyCode === 27) { // escape
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        }
    },

    _renderDeviceInfo: function() {
        var device = this.state.device;
        if (!device) {
            return (<i>{ _t('unknown device') }</i>);
        }

        var verificationStatus = (<b>{ _t('NOT verified') }</b>);
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
                        <td><code>{device.getFingerprint()}</code></td>
                    </tr>
                </tbody>
            </table>
        );
    },

    _renderEventInfo: function() {
        var event = this.props.event;

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
        var DeviceVerifyButtons = sdk.getComponent('elements.DeviceVerifyButtons');

        var buttons = null;
        if (this.state.device) {
            buttons = (
                <DeviceVerifyButtons device={ this.state.device }
                    userId={ this.props.event.getSender() }
                />
            );
        }

        return (
            <div className="mx_EncryptedEventDialog" onKeyDown={ this.onKeyDown }>
                <div className="mx_Dialog_title">
                    { _t('End-to-end encryption information') }
                </div>
                <div className="mx_Dialog_content">
                    <h4>{ _t('Event information') }</h4>
                    {this._renderEventInfo()}

                    <h4>{ _t('Sender device information') }</h4>
                    {this._renderDeviceInfo()}
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={ this.props.onFinished } autoFocus={ true }>
                        { _t('OK') }
                    </button>
                    {buttons}
                </div>
            </div>
        );
    }
});
