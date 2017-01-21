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
    displayName: 'UnknownEventDialog',

    propTypes: {
        devices: React.PropTypes.object.isRequired,
        onFinished: React.PropTypes.func.isRequired,
    },

    onKeyDown: function(e) {
        if (e.keyCode === 27) { // escape
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        }
    },

    render: function() {
        return (
            <div className="mx_UnknownDeviceDialog" onKeyDown={ this.onKeyDown }>
                <div className="mx_Dialog_title">
                    Room contains unknown devices
                </div>
                <div className="mx_Dialog_content">
                    <h4>This room contains unknown devices which have not been verified.</h4>
                    <h4>We strongly recommend you verify them before continuing.</h4>
                    <p>Unknown devices:
                        <ul>{
                            Object.keys(this.props.devices).map(userId=>{
                                return <li key={ userId }>
                                    <p>{ userId }:</p>
                                    <ul>
                                    {
                                        Object.keys(this.props.devices[userId]).map(deviceId=>{
                                            return <li key={ deviceId }>
                                                { deviceId } ( { this.props.devices[userId][deviceId].getDisplayName() } )
                                            </li>
                                        })
                                    }
                                    </ul>
                                </li>
                            })
                        }</ul>
                    </p>
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={ this.props.onFinished } autoFocus={ true }>
                        OK
                    </button>
                </div>
            </div>
        );
        // XXX: do we want to give the user the option to enable blacklistUnverifiedDevices for this room (or globally) at this point?
        // It feels like confused users will likely turn it on and then disappear in a cloud of UISIs...
    }
});
