/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import { IconButton } from "@vector-im/compound-web";
import { SidebarIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import BaseCard from "./BaseCard";
import { _t } from "../../../languageHandler";
import Stickerpicker from "../rooms/Stickerpicker";
import RoomContext from "../../../contexts/RoomContext";
import dis from "../../../dispatcher/dispatcher";
import { setStickerpickerAttachedToSidebar } from "../rooms/StickerpickerSidebarStore";
import Heading from "../typography/Heading";

interface IProps {
    onClose(this: void): void;
}

const StickerpickerCard: React.FC<IProps> = ({ onClose }) => {
    const roomContext = useContext(RoomContext);
    const room = roomContext.room;
    if (!room) return null;

    const onDetachClick = (): void => {
        setStickerpickerAttachedToSidebar(false);
        dis.dispatch({
            action: "stickerpicker_detach_from_sidebar",
            roomId: room.roomId,
        });
        onClose();
    };

    const header = (
        <div className="mx_BaseCard_header_title">
            <Heading size="4" className="mx_BaseCard_header_title_heading" as="h1">
                {_t("common|sticker")}
            </Heading>
            <IconButton
                size="28px"
                onClick={onDetachClick}
                tooltip={_t("stickers|detach_from_sidebar")}
                kind="secondary"
            >
                <SidebarIcon />
            </IconButton>
        </div>
    );

    return (
        <BaseCard header={header} className="mx_WidgetCard" onClose={onClose} withoutScrollContainer>
            <Stickerpicker
                room={room}
                threadId={roomContext.threadId ?? null}
                isStickerPickerOpen={true}
                setStickerPickerOpen={() => onClose()}
                displayMode="sidebar"
            />
        </BaseCard>
    );
};

export default StickerpickerCard;
