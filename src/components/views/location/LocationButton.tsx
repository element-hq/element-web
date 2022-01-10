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

import React, { ReactElement } from 'react';
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from 'classnames';

import { _t } from '../../../languageHandler';
import LocationPicker from './LocationPicker';
import { CollapsibleButton, ICollapsibleButtonProps } from '../rooms/CollapsibleButton';
import ContextMenu, { aboveLeftOf, useContextMenu, AboveLeftOf } from "../../structures/ContextMenu";

interface IProps extends Pick<ICollapsibleButtonProps, "narrowMode"> {
    room: Room;
    shareLocation: (uri: string, ts: number) => boolean;
    menuPosition: AboveLeftOf;
    narrowMode: boolean;
}

export const LocationButton: React.FC<IProps> = (
    { shareLocation, menuPosition, narrowMode },
) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu: ReactElement;
    if (menuDisplayed) {
        const position = menuPosition ?? aboveLeftOf(
            button.current.getBoundingClientRect());

        contextMenu = <ContextMenu
            {...position}
            onFinished={closeMenu}
            managed={false}
        >
            <LocationPicker onChoose={shareLocation} onFinished={closeMenu} />
        </ContextMenu>;
    }

    const className = classNames(
        "mx_MessageComposer_button",
        "mx_MessageComposer_location",
        {
            "mx_MessageComposer_button_highlight": menuDisplayed,
        },
    );

    // TODO: replace ContextMenuTooltipButton with a unified representation of
    // the header buttons and the right panel buttons
    return <React.Fragment>
        <CollapsibleButton
            className={className}
            onClick={openMenu}
            narrowMode={narrowMode}
            title={_t("Share location")}
        />

        { contextMenu }
    </React.Fragment>;
};

export function textForLocation(
    uri: string,
    ts: number,
    description: string | null,
): string {
    const date = new Date(ts).toISOString();
    if (description) {
        return `Location "${description}" ${uri} at ${date}`;
    } else {
        return `Location ${uri} at ${date}`;
    }
}

export default LocationButton;
