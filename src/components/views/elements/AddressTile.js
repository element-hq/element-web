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

// React PropType definition for an object describing
// an address that can be invited to a room (which
// could be a third party identifier or a matrix ID)
// along with some additional information about the
// address / target.
export const InviteAddressType = React.PropTypes.shape({
    addressType: React.PropTypes.oneOf([
        'mx', 'email'
    ]).isRequired,
    address: React.PropTypes.string.isRequired,
    displayName: React.PropTypes.string,
    avatarMxc: React.PropTypes.string,
    // true if the address is known to be a valid address (eg. is a real
    // user we've seen) or false otherwise (eg. is just an address the
    // user has entered)
    isKnown: React.PropTypes.bool,
});


export default React.createClass({
    displayName: 'AddressTile',

    propTypes: {
        address: InviteAddressType.isRequired,
        canDismiss: React.PropTypes.bool,
        onDismissed: React.PropTypes.func,
        justified: React.PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            canDismiss: false,
            onDismissed: function() {}, // NOP
            justified: false,
        };
    },

    render: function() {
        const address = this.props.address;
        const name = address.displayName || address.address;

        let imgUrls = [];

        if (address.addressType === "mx" && address.avatarMxc) {
            imgUrls.push(MatrixClientPeg.get().mxcUrlToHttp(
                address.avatarMxc, 25, 25, 'crop'
            ));
        } else if (address.addressType === 'email') {
            imgUrls.push('img/icon-email-user.svg');
        }

        // Removing networks for now as they're not really supported
        /*
        var network;
        if (this.props.networkUrl !== "") {
            network = (
                <div className="mx_AddressTile_network">
                    <BaseAvatar width={25} height={25} name={this.props.networkName} title="Riot" url={this.props.networkUrl} />
                </div>
            );
        }
        */

        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        const nameClasses = classNames({
            "mx_AddressTile_name": true,
            "mx_AddressTile_justified": this.props.justified,
        });

        let info;
        let error = false;
        if (address.addressType === "mx" && address.isKnown) {
            const idClasses = classNames({
                "mx_AddressTile_id": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            info = (
                <div className="mx_AddressTile_mx">
                    <div className={nameClasses}>{ name }</div>
                    <div className={idClasses}>{ address.address }</div>
                </div>
            );
        } else if (address.addressType === "mx") {
            const unknownMxClasses = classNames({
                "mx_AddressTile_unknownMx": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            info = (
                <div className={unknownMxClasses}>{ this.props.address.address }</div>
            );
        } else if (address.addressType === "email") {
            const emailClasses = classNames({
                "mx_AddressTile_email": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            let nameNode = null;
            if (address.displayName) {
                nameNode = <div className={nameClasses}>{ address.displayName }</div>
            }

            info = (
                <div className="mx_AddressTile_mx">
                    <div className={emailClasses}>{ address.address }</div>
                    {nameNode}
                </div>
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

        const classes = classNames({
            "mx_AddressTile": true,
            "mx_AddressTile_error": error,
        });

        let dismiss;
        if (this.props.canDismiss) {
            dismiss = (
                <div className="mx_AddressTile_dismiss" onClick={this.props.onDismissed} >
                    <TintableSvg src="img/icon-address-delete.svg" width="9" height="9" />
                </div>
            );
        }

        return (
            <div className={classes}>
                <div className="mx_AddressTile_avatar">
                    <BaseAvatar defaultToInitialLetter={true} width={25} height={25} name={name} title={name} urls={imgUrls} />
                </div>
                { info }
                { dismiss }
            </div>
        );
    }
});
