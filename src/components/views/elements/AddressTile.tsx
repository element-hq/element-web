/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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
import classNames from 'classnames';

import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { mediaFromMxc } from "../../../customisations/Media";
import { IUserAddress } from '../../../UserAddress';
import BaseAvatar from '../avatars/BaseAvatar';
import EmailUserIcon from "../../../../res/img/icon-email-user.svg";

interface IProps {
    address: IUserAddress;
    canDismiss?: boolean;
    onDismissed?: () => void;
    justified?: boolean;
    showAddress?: boolean;
}

@replaceableComponent("views.elements.AddressTile")
export default class AddressTile extends React.Component<IProps> {
    static defaultProps: Partial<IProps> = {
        canDismiss: false,
        onDismissed: function() {}, // NOP
        justified: false,
    };

    render() {
        const address = this.props.address;
        const name = address.displayName || address.address;

        const imgUrls = [];
        const isMatrixAddress = ['mx-user-id', 'mx-room-id'].includes(address.addressType);

        if (isMatrixAddress && address.avatarMxc) {
            imgUrls.push(mediaFromMxc(address.avatarMxc).getSquareThumbnailHttp(25));
        } else if (address.addressType === 'email') {
            imgUrls.push(EmailUserIcon);
        }

        const nameClasses = classNames({
            "mx_AddressTile_name": true,
            "mx_AddressTile_justified": this.props.justified,
        });

        let info;
        let error = false;
        if (isMatrixAddress && address.isKnown) {
            const idClasses = classNames({
                "mx_AddressTile_id": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            info = (
                <div className="mx_AddressTile_mx">
                    <div className={nameClasses}>{ name }</div>
                    {
                        this.props.showAddress
                            ? <div className={idClasses}>{ address.address }</div>
                            : <div />
                    }
                </div>
            );
        } else if (isMatrixAddress) {
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
                nameNode = <div className={nameClasses}>{ address.displayName }</div>;
            }

            info = (
                <div className="mx_AddressTile_mx">
                    <div className={emailClasses}>{ address.address }</div>
                    { nameNode }
                </div>
            );
        } else {
            error = true;
            const unknownClasses = classNames({
                "mx_AddressTile_unknown": true,
                "mx_AddressTile_justified": this.props.justified,
            });

            info = (
                <div className={unknownClasses}>{ _t("Unknown Address") }</div>
            );
        }

        const classes = classNames({
            "mx_AddressTile": true,
            "mx_AddressTile_error": error,
        });

        let dismiss;
        if (this.props.canDismiss) {
            dismiss = (
                <div className="mx_AddressTile_dismiss" onClick={this.props.onDismissed}>
                    <img src={require("../../../../res/img/icon-address-delete.svg")} width="9" height="9" />
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
}
