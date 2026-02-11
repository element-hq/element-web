/*
Copyright 2020-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import { _t } from "../../../languageHandler";
import ContextMenu, { type IProps as IContextMenuProps, MenuItem } from "../../structures/ContextMenu";
import LegacyCallHandler from "../../../LegacyCallHandler";

interface IProps extends IContextMenuProps {
    call: MatrixCall;
}

export default class LegacyCallContextMenu extends React.Component<IProps> {
    public onHoldClick = (): void => {
        this.props.call.setRemoteOnHold(true);
        this.props.onFinished();
    };

    public onUnholdClick = (): void => {
        LegacyCallHandler.instance.setActiveCallRoomId(this.props.call.roomId);

        this.props.onFinished();
    };

    public onTransferClick = (): void => {
        LegacyCallHandler.instance.showTransferDialog(this.props.call);
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        const holdUnholdCaption = this.props.call.isRemoteOnHold() ? _t("action|resume") : _t("action|hold");
        const handler = this.props.call.isRemoteOnHold() ? this.onUnholdClick : this.onHoldClick;

        let transferItem;
        if (this.props.call.opponentCanBeTransferred()) {
            transferItem = (
                <MenuItem className="mx_LegacyCallContextMenu_item" onClick={this.onTransferClick}>
                    {_t("action|transfer")}
                </MenuItem>
            );
        }

        return (
            <ContextMenu {...this.props}>
                <MenuItem className="mx_LegacyCallContextMenu_item" onClick={handler}>
                    {holdUnholdCaption}
                </MenuItem>
                {transferItem}
            </ContextMenu>
        );
    }
}
