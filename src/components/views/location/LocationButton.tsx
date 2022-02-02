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

import React, { ReactElement, SyntheticEvent, useContext } from 'react';
import classNames from 'classnames';
import { RoomMember } from 'matrix-js-sdk/src/models/room-member';
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { makeLocationContent } from "matrix-js-sdk/src/content-helpers";

import { _t } from '../../../languageHandler';
import LocationPicker from './LocationPicker';
import { CollapsibleButton } from '../rooms/CollapsibleButton';
import ContextMenu, { aboveLeftOf, useContextMenu, AboveLeftOf } from "../../structures/ContextMenu";
import Modal from '../../../Modal';
import QuestionDialog from '../dialogs/QuestionDialog';
import MatrixClientContext from '../../../contexts/MatrixClientContext';
import { OverflowMenuContext } from "../rooms/MessageComposerButtons";

interface IProps {
    roomId: string;
    sender: RoomMember;
    menuPosition: AboveLeftOf;
}

export const LocationButton: React.FC<IProps> = ({ roomId, sender, menuPosition }) => {
    const overflowMenuCloser = useContext(OverflowMenuContext);
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();
    const matrixClient = useContext(MatrixClientContext);

    const _onFinished = (ev?: SyntheticEvent) => {
        closeMenu(ev);
        overflowMenuCloser?.();
    };

    let contextMenu: ReactElement;
    if (menuDisplayed) {
        const position = menuPosition ?? aboveLeftOf(
            button.current.getBoundingClientRect());

        contextMenu = <ContextMenu
            {...position}
            onFinished={_onFinished}
            managed={false}
        >
            <LocationPicker
                sender={sender}
                onChoose={shareLocation(matrixClient, roomId, openMenu)}
                onFinished={_onFinished}
            />
        </ContextMenu>;
    }

    const className = classNames(
        "mx_MessageComposer_button",
        "mx_MessageComposer_location",
        {
            "mx_MessageComposer_button_highlight": menuDisplayed,
        },
    );

    return <React.Fragment>
        <CollapsibleButton
            className={className}
            onClick={openMenu}
            title={_t("Location")}
        />

        { contextMenu }
    </React.Fragment>;
};

const shareLocation = (client: MatrixClient, roomId: string, openMenu: () => void) =>
    (uri: string, ts: number) => {
        if (!uri) return false;
        try {
            const text = textForLocation(uri, ts, null);
            client.sendMessage(
                roomId,
                makeLocationContent(text, uri, ts, null),
            );
        } catch (e) {
            logger.error("We couldn’t send your location", e);

            const analyticsAction = 'We couldn’t send your location';
            const params = {
                title: _t("We couldn’t send your location"),
                description: _t(
                    "Element could not send your location. Please try again later."),
                button: _t('Try again'),
                cancelButton: _t('Cancel'),
                onFinished: (tryAgain: boolean) => {
                    if (tryAgain) {
                        openMenu();
                    }
                },
            };
            Modal.createTrackedDialog(analyticsAction, '', QuestionDialog, params);
        }
        return true;
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
