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
            return (<i>unknown device</i>);
        }

        var verificationStatus = (<b>NOT verified</b>);
        if (device.isBlocked()) {
            verificationStatus = (<b>Blacklisted</b>);
        } else if (device.isVerified()) {
            verificationStatus = "verified";
        }

        return (
            <table>
                <tbody>
                    <tr>
                        <td>Name</td>
                        <td>{ device.getDisplayName() }</td>
                    </tr>
                    <tr>
                        <td>Device ID</td>
                        <td><code>{ device.deviceId }</code></td>
                    </tr>
                    <tr>
                        <td>Verification</td>
                        <td>{ verificationStatus }</td>
                    </tr>
                    <tr>
                        <td>Ed25519 fingerprint</td>
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
                        <td>User ID</td>
                        <td>{ event.getSender() }</td>
                    </tr>
                    <tr>
                        <td>Curve25519 identity key</td>
                        <td><code>{ event.getSenderKey() || <i>none</i> }</code></td>
                    </tr>
                    <tr>
                        <td>Claimed Ed25519 fingerprint key</td>
                        <td><code>{ event.getKeysClaimed().ed25519 || <i>none</i> }</code></td>
                    </tr>
                    <tr>
                        <td>Algorithm</td>
                        <td>{ event.getWireContent().algorithm || <i>unencrypted</i> }</td>
                    </tr>
                {
                    event.getContent().msgtype === 'm.bad.encrypted' ? (
                    <tr>
                        <td>Decryption error</td>
                        <td>{ event.getContent().body }</td>
                    </tr>
                    ) : null
                }
                    <tr>
                        <td>Session ID</td>
                        <td><code>{ event.getWireContent().session_id || <i>none</i> }</code></td>
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
                    End-to-end encryption information
                </div>
                <div className="mx_Dialog_content">
                    <h4>Event information</h4>
                    {this._renderEventInfo()}

                    <h4>Sender device information</h4>
                    {this._renderDeviceInfo()}
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={ this.props.onFinished } autoFocus={ true }>
                        OK
                    </button>
                    {buttons}
                </div>
            </div>
        );
    }
});
