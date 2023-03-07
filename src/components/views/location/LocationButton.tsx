/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode, SyntheticEvent, useContext } from "react";
import classNames from "classnames";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { IEventRelation } from "matrix-js-sdk/src/models/event";

import { _t } from "../../../languageHandler";
import { CollapsibleButton } from "../rooms/CollapsibleButton";
import { aboveLeftOf, useContextMenu, MenuProps } from "../../structures/ContextMenu";
import { OverflowMenuContext } from "../rooms/MessageComposerButtons";
import LocationShareMenu from "./LocationShareMenu";

interface IProps {
    roomId: string;
    sender: RoomMember;
    menuPosition?: MenuProps;
    relation?: IEventRelation;
}

export const LocationButton: React.FC<IProps> = ({ roomId, sender, menuPosition, relation }) => {
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
                title={_t("Location")}
                inputRef={button}
            />

            {contextMenu}
        </React.Fragment>
    );
};

export default LocationButton;
