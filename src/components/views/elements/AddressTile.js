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
var Invite = require("../../../Invite");
var MatrixClientPeg = require("../../../MatrixClientPeg");
var Avatar = require('../../../Avatar');

module.exports = React.createClass({
    displayName: 'AddressTile',

    propTypes: {
        address: React.PropTypes.string.isRequired,
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
        var userId, name, imgUrl, email;
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        // Check if the addr is a valid type
        var addrType = Invite.getAddressType(this.props.address);
        if (addrType === "mx") {
            let user = MatrixClientPeg.get().getUser(this.props.address);
            if (user) {
                userId = user.userId;
                name = user.rawDisplayName || userId;
                imgUrl = Avatar.avatarUrlForUser(user, 25, 25, "crop");
            } else {
                name=this.props.address;
                imgUrl = "img/icon-mx-user.svg";
            }
        } else if (addrType === "email") {
            email = this.props.address;
            name="email";
            imgUrl = "img/icon-email-user.svg";
        } else {
            name="Unknown";
            imgUrl = "img/avatar-error.svg";
        }

        var network;
        if (this.props.networkUrl !== "") {
            network = (
                <div className="mx_AddressTile_network">
                    <BaseAvatar width={25} height={25} name={this.props.networkName} title="Riot" url={this.props.networkUrl} />
                </div>
            );
        }

        var info;
        var error = false;
        if (addrType === "mx" && userId) {
            var nameClasses = classNames({
                "mx_AddressTile_name": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            var idClasses = classNames({
                "mx_AddressTile_id": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            info = (
                <div className="mx_AddressTile_mx">
                    <div className={nameClasses}>{ name }</div>
                    <div className={idClasses}>{ userId }</div>
                </div>
            );
        } else if (addrType === "mx") {
            var unknownMxClasses = classNames({
                "mx_AddressTile_unknownMx": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            info = (
                <div className={unknownMxClasses}>{ this.props.address }</div>
            );
        } else if (email) {
            var emailClasses = classNames({
                "mx_AddressTile_email": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            info = (
                <div className={emailClasses}>{ email }</div>
            );
        } else {
            error = true;
            var unknownClasses = classNames({
                "mx_AddressTile_unknown": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            info = (
                <div className={unknownClasses}>Unknown Address</div>
            );
        }

        var classes = classNames({
            "mx_AddressTile": true,
            "mx_AddressTile_error": error,
        });

        var dismiss;
        if (this.props.canDismiss) {
            dismiss = (
                <div className="mx_AddressTile_dismiss" onClick={this.props.onDismissed} >
                    <TintableSvg src="img/icon-address-delete.svg" width="9" height="9" />
                </div>
            );
        }

        return (
            <div className={classes}>
                { network }
                <div className="mx_AddressTile_avatar">
                    <BaseAvatar width={25} height={25} name={name} title={name} url={imgUrl} />
                </div>
                { info }
                { dismiss }
            </div>
        );
    }
});
