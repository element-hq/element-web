/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { Suspense } from "react";
import classNames from "classnames";
import { type Room } from "matrix-js-sdk/src/matrix";
import { type IWidget } from "matrix-widget-api";

import { _t } from "../../../languageHandler";
import PersistedElement from "../elements/PersistedElement";
import type { UserWidget } from "../../../utils/WidgetUtils";
import Spinner from "../elements/Spinner";

export const STICKERPICKER_Z_INDEX = 3500;
export const PERSISTED_ELEMENT_KEY = "stickerPicker";

const AppTile = React.lazy(async () => import("../elements/AppTile"));

interface IProps {
    room: Room;
    threadId?: string | null;
    stickerpickerWidget: UserWidget;
    displayMode: "popover" | "sidebar";
    popoverWidth: number;
    popoverHeight: number;
    onEditClick: () => void;
    onDeleteClick: () => void;
    onAttachToSidebarClick?: () => void;
}

const StickerpickerHost: React.FC<IProps> = ({
    room,
    threadId,
    stickerpickerWidget,
    displayMode,
    popoverWidth,
    popoverHeight,
    onEditClick,
    onDeleteClick,
    onAttachToSidebarClick,
}) => {
    const currentUserId = room.client.getSafeUserId();
    const stickerApp: IWidget = {
        id: stickerpickerWidget.id,
        url: stickerpickerWidget.content.url,
        name: stickerpickerWidget.content.name || _t("common|stickerpack"),
        type: stickerpickerWidget.content.type,
        data: stickerpickerWidget.content.data,
        creatorUserId: stickerpickerWidget.content.creatorUserId || stickerpickerWidget.sender,
    };

    const sidebarMode = displayMode === "sidebar";

    return (
        <div
            className={classNames("mx_Stickers_host", {
                mx_Stickers_host_popover: !sidebarMode,
                mx_Stickers_host_sidebar: sidebarMode,
            })}
        >
            <PersistedElement persistKey={PERSISTED_ELEMENT_KEY} zIndex={STICKERPICKER_Z_INDEX}>
                <div
                    className={classNames("mx_Stickers_hostInner", {
                        mx_Stickers_hostInner_popover: !sidebarMode,
                        mx_Stickers_hostInner_sidebar: sidebarMode,
                    })}
                    style={
                        sidebarMode
                            ? undefined
                            : {
                                  width: popoverWidth,
                                  height: popoverHeight,
                                  border: "none",
                              }
                    }
                >
                    <Suspense
                        fallback={
                            <div className="mx_Stickers_loading">
                                <Spinner message={_t("common|loading")} />
                            </div>
                        }
                    >
                        <AppTile
                            app={stickerApp}
                            room={room}
                            threadId={threadId}
                            fullWidth={true}
                            userId={currentUserId}
                            creatorUserId={stickerpickerWidget.sender || currentUserId}
                            waitForIframeLoad={true}
                            showMenubar={!sidebarMode}
                            closeOnStickerSend={!sidebarMode}
                            onEditClick={onEditClick}
                            onDeleteClick={onDeleteClick}
                            onAttachToSidebarClick={!sidebarMode ? onAttachToSidebarClick : undefined}
                            showTitle={false}
                            showPopout={false}
                            handleMinimisePointerEvents={true}
                            userWidget={true}
                            showLayoutButtons={false}
                        />
                    </Suspense>
                </div>
            </PersistedElement>
        </div>
    );
};

export default StickerpickerHost;
