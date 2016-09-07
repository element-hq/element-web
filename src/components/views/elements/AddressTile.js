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

'use strict';

var React = require('react');
var classNames = require('classnames');
var sdk = require("../../../index");
var Avatar = require('../../../Avatar');

module.exports = React.createClass({
    displayName: 'AddressTile',

    propTypes: {
        user: React.PropTypes.object.isRequired,
        canDismiss: React.PropTypes.bool,
        onDismissed: React.PropTypes.func,
        justified: React.PropTypes.bool,
        networkName: React.PropTypes.string,
        networkUrl: React.PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            canDismiss: false,
            onDismissed: function() {}, // NOP
            justified: false,
            networkName: "",
            networkUrl: "",
        };
    },

    render: function() {
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var userId = this.props.user.userId;
        var name = this.props.user.displayName || userId;
        var imgUrl = Avatar.avatarUrlForUser(this.props.user, 25, 25, "crop");

        var network;
        if (this.props.networkUrl !== "") {
            network = (
                <div className="mx_AddressTile_network">
                    <BaseAvatar width={25} height={25} name={this.props.networkName} title="vector" url={this.props.networkUrl} />
                </div>
            );
        }

        var dismiss;
        if (this.props.canDismiss) {
            dismiss = (
                <div className="mx_AddressTile_dismiss" onClick={this.props.onDismissed} >
                    <TintableSvg src="img/icon-address-delete.svg" width="9" height="9" />
                </div>
            );
        }

        var nameClasses = classNames({
            "mx_AddressTile_name": true,
            "mx_AddressTile_justified": this.props.justified,
        });

        var idClasses = classNames({
            "mx_AddressTile_id": true,
            "mx_AddressTile_justified": this.props.justified,
        });

        return (
            <div className="mx_AddressTile">
                { network }
                <div className="mx_AddressTile_avatar">
                    <BaseAvatar width={25} height={25} name={name} title={name} url={imgUrl} />
                </div>
                <div className={nameClasses}>{ name }</div>
                <div className={idClasses}>{ userId }</div>
                { dismiss }
            </div>
        );
    }
});
