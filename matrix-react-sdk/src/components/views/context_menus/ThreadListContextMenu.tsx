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

import React, { useCallback, useEffect } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { ButtonEvent } from "../elements/AccessibleButton";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { copyPlaintext } from "../../../utils/strings";
import { ChevronFace, ContextMenuTooltipButton, MenuProps, useContextMenu } from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";

export interface ThreadListContextMenuProps {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    onMenuToggle?: (open: boolean) => void;
}

const contextMenuBelow = (elementRect: DOMRect): MenuProps => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.scrollX + elementRect.width;
    const top = elementRect.bottom + window.scrollY;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

const ThreadListContextMenu: React.FC<ThreadListContextMenuProps> = ({
    mxEvent,
    permalinkCreator,
    onMenuToggle,
    ...props
}) => {
    const [menuDisplayed, button, openMenu, closeThreadOptions] = useContextMenu();

    const viewInRoom = useCallback(
        (evt: ButtonEvent): void => {
            evt.preventDefault();
            evt.stopPropagation();
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                event_id: mxEvent.getId(),
                highlighted: true,
                room_id: mxEvent.getRoomId(),
                metricsTrigger: undefined, // room doesn't change
            });
            closeThreadOptions();
        },
        [mxEvent, closeThreadOptions],
    );

    const copyLinkToThread = useCallback(
        async (evt: ButtonEvent | undefined): Promise<void> => {
            if (permalinkCreator) {
                evt?.preventDefault();
                evt?.stopPropagation();
                const matrixToUrl = permalinkCreator.forEvent(mxEvent.getId()!);
                await copyPlaintext(matrixToUrl);
                closeThreadOptions();
            }
        },
        [mxEvent, closeThreadOptions, permalinkCreator],
    );

    useEffect(() => {
        onMenuToggle?.(menuDisplayed);
    }, [menuDisplayed, onMenuToggle]);

    const room = MatrixClientPeg.get().getRoom(mxEvent.getRoomId());
    const isMainSplitTimelineShown = !!room && !WidgetLayoutStore.instance.hasMaximisedWidget(room);
    return (
        <React.Fragment>
            <ContextMenuTooltipButton
                {...props}
                className="mx_BaseCard_header_title_button--option"
                onClick={openMenu}
                title={_t("Thread options")}
                isExpanded={menuDisplayed}
                inputRef={button}
                data-testid="threadlist-dropdown-button"
            />
            {menuDisplayed && (
                <IconizedContextMenu
                    onFinished={closeThreadOptions}
                    className="mx_RoomTile_contextMenu"
                    compact
                    rightAligned
                    {...contextMenuBelow(button.current!.getBoundingClientRect())}
                >
                    <IconizedContextMenuOptionList>
                        {isMainSplitTimelineShown && (
                            <IconizedContextMenuOption
                                onClick={(e) => viewInRoom(e)}
                                label={_t("View in room")}
                                iconClassName="mx_ThreadPanel_viewInRoom"
                            />
                        )}
                        {permalinkCreator && (
                            <IconizedContextMenuOption
                                data-testid="copy-thread-link"
                                onClick={(e) => copyLinkToThread(e)}
                                label={_t("Copy link to thread")}
                                iconClassName="mx_ThreadPanel_copyLinkToThread"
                            />
                        )}
                    </IconizedContextMenuOptionList>
                </IconizedContextMenu>
            )}
        </React.Fragment>
    );
};

export default ThreadListContextMenu;
