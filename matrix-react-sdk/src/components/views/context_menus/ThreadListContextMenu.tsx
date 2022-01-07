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

import React, { RefObject, useCallback, useEffect } from "react";
import { MatrixEvent } from "matrix-js-sdk/src";

import { ButtonEvent } from "../elements/AccessibleButton";
import dis from '../../../dispatcher/dispatcher';
import { Action } from "../../../dispatcher/actions";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { copyPlaintext } from "../../../utils/strings";
import { ChevronFace, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { useRovingTabIndex } from "../../../accessibility/RovingTabIndex";

interface IProps {
    mxEvent: MatrixEvent;
    permalinkCreator: RoomPermalinkCreator;
    onMenuToggle?: (open: boolean) => void;
}

interface IExtendedProps extends IProps {
    // Props for making the button into a roving one
    tabIndex?: number;
    inputRef?: RefObject<HTMLElement>;
    onFocus?(): void;
}

const contextMenuBelow = (elementRect: DOMRect) => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.pageXOffset + elementRect.width;
    const top = elementRect.bottom + window.pageYOffset;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

export const RovingThreadListContextMenu: React.FC<IProps> = (props) => {
    const [onFocus, isActive, ref] = useRovingTabIndex();

    return <ThreadListContextMenu
        {...props}
        onFocus={onFocus}
        tabIndex={isActive ? 0 : -1}
        inputRef={ref}
    />;
};

const ThreadListContextMenu: React.FC<IExtendedProps> = ({
    mxEvent,
    permalinkCreator,
    onMenuToggle,
    onFocus,
    inputRef,
    ...props
}) => {
    const [menuDisplayed, _ref, openMenu, closeThreadOptions] = useContextMenu();
    const button = inputRef ?? _ref; // prefer the ref we receive via props in case we are being controlled

    const viewInRoom = useCallback((evt: ButtonEvent): void => {
        evt.preventDefault();
        evt.stopPropagation();
        dis.dispatch({
            action: Action.ViewRoom,
            event_id: mxEvent.getId(),
            highlighted: true,
            room_id: mxEvent.getRoomId(),
        });
        closeThreadOptions();
    }, [mxEvent, closeThreadOptions]);

    const copyLinkToThread = useCallback(async (evt: ButtonEvent) => {
        evt.preventDefault();
        evt.stopPropagation();
        const matrixToUrl = permalinkCreator.forEvent(mxEvent.getId());
        await copyPlaintext(matrixToUrl);
        closeThreadOptions();
    }, [mxEvent, closeThreadOptions, permalinkCreator]);

    useEffect(() => {
        if (onMenuToggle) {
            onMenuToggle(menuDisplayed);
        }
        onFocus?.();
    }, [menuDisplayed, onMenuToggle, onFocus]);

    const isMainSplitTimelineShown = !WidgetLayoutStore.instance.hasMaximisedWidget(
        MatrixClientPeg.get().getRoom(mxEvent.getRoomId()),
    );
    return <React.Fragment>
        <ContextMenuTooltipButton
            {...props}
            className="mx_MessageActionBar_maskButton mx_MessageActionBar_optionsButton"
            onClick={openMenu}
            title={_t("Thread options")}
            isExpanded={menuDisplayed}
            inputRef={button}
        />
        { menuDisplayed && (<IconizedContextMenu
            onFinished={closeThreadOptions}
            className="mx_RoomTile_contextMenu"
            compact
            rightAligned
            {...contextMenuBelow(button.current.getBoundingClientRect())}
        >
            <IconizedContextMenuOptionList>
                { isMainSplitTimelineShown &&
                 <IconizedContextMenuOption
                     onClick={(e) => viewInRoom(e)}
                     label={_t("View in room")}
                     iconClassName="mx_ThreadPanel_viewInRoom"
                 /> }
                <IconizedContextMenuOption
                    onClick={(e) => copyLinkToThread(e)}
                    label={_t("Copy link to thread")}
                    iconClassName="mx_ThreadPanel_copyLinkToThread"
                />
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>) }
    </React.Fragment>;
};

export default ThreadListContextMenu;
