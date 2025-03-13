/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, type SyntheticEvent, useContext } from "react";
import classNames from "classnames";
import { type RoomMember, type IEventRelation } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { CollapsibleButton } from "../rooms/CollapsibleButton";
import { aboveLeftOf, useContextMenu, type MenuProps } from "../../structures/ContextMenu";
import { OverflowMenuContext } from "../rooms/MessageComposerButtons";
import LocationShareMenu from "./LocationShareMenu";

export interface IProps {
    roomId: string;
    sender: RoomMember;
    menuPosition?: MenuProps;
    relation?: IEventRelation;
}

const LocationButton: React.FC<IProps> = ({ roomId, sender, menuPosition, relation }) => {
    const overflowMenuCloser = useContext(OverflowMenuContext);
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    const _onFinished = (ev?: SyntheticEvent): void => {
        closeMenu(ev);
        overflowMenuCloser?.();
    };

    let contextMenu: ReactNode = null;
    if (menuDisplayed) {
        const position = menuPosition ?? (button.current && aboveLeftOf(button.current.getBoundingClientRect())) ?? {};

        contextMenu = (
            <LocationShareMenu
                menuPosition={position}
                onFinished={_onFinished}
                sender={sender}
                roomId={roomId}
                openMenu={openMenu}
                relation={relation}
            />
        );
    }

    const className = classNames("mx_MessageComposer_button", {
        mx_MessageComposer_button_highlight: menuDisplayed,
    });

    return (
        <React.Fragment>
            <CollapsibleButton
                className={className}
                iconClassName="mx_MessageComposer_location"
                onClick={openMenu}
                title={_t("common|location")}
                inputRef={button}
            />

            {contextMenu}
        </React.Fragment>
    );
};

export default LocationButton;
