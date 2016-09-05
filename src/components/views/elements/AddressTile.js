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
var sdk = require("../../../index");
var Avatar = require('../../../Avatar');

module.exports = React.createClass({
    displayName: 'AddressTile',

    propTypes: {
        user: React.PropTypes.object.isRequired,
        canDismiss: React.PropTypes.bool,
        onDismissed: React.PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            canDismiss: false,
            onDismissed: function() {}, // NOP
        };
    },

    render: function() {
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var name = this.props.user.displayName || this.props.user.userId
        var imgUrl = Avatar.avatarUrlForUser(this.props.user, 25, 25, "crop");

        var dismiss;
        if (this.props.canDismiss) {
            dismiss = (
                <div className="mx_AddressTile_dismiss" onClick={this.props.onDismissed} >
                    <TintableSvg src="img/icon-address-delete.svg" width="9" height="9" />
                </div>
            );
        }

        return (
            <div className="mx_AddressTile">
                <div className="mx_AddressTile_avatar">
                    <BaseAvatar width={25} height={25} name={name} url={imgUrl} />
                </div>
                <div className="mx_AddressTile_name">{ name }</div>
                <div className="mx_AddressTile_id">{ this.props.user.userId }</div>
                { dismiss }
            </div>
        );
    }
});
