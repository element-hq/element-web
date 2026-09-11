/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Robin Townsend <robin@robin.town>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useMemo } from "react";
import classnames from "classnames";
import { MatrixEvent, type RoomMember } from "matrix-js-sdk/src/matrix";
import { ForwardDialogView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { useSettingValue } from "../../../hooks/useSettings";
import { Layout } from "../../../settings/enums/Layout";
import { EventPresentationContextProvider } from "../../../utils/EventPresentationContextProvider";
import BaseDialog from "./BaseDialog";
import EventTile from "../rooms/EventTile";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { ForwardDialogViewModel } from "../../../viewmodels/dialogs/ForwardDialogViewModel";
import { SDKContext } from "../../../contexts/SDKContext";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";

const AVATAR_SIZE = 30;

interface IProps {
    // The event to forward
    event: MatrixEvent;
    // We need a permalink creator for the source room to pass through to EventTile
    // in case the event is a reply (even though the user can't get at the link)
    permalinkCreator: RoomPermalinkCreator;
    onFinished(this: void): void;
}

const ForwardDialog: React.FC<IProps> = ({ event, permalinkCreator, onFinished }) => {
    // Dialogs are rendered in their own React root, which provides SDKContext but not MatrixClientContext.
    const matrixClient = useContext(SDKContext).client!;
    const vm = useCreateAutoDisposedViewModel(
        () => new ForwardDialogViewModel({ matrixClient, event, onFinished }),
    );

    const userId = matrixClient.getSafeUserId();
    const ownProfile = useEventEmitterState(OwnProfileStore.instance, UPDATE_EVENT, () => ({
        displayName: OwnProfileStore.instance.displayName,
        avatarMxc: OwnProfileStore.instance.avatarMxc,
        avatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_SIZE),
    }));

    const mockEvent = useMemo(() => {
        // For the message preview we fake the sender as ourselves
        const ev = new MatrixEvent({
            type: "m.room.message",
            sender: userId,
            content: vm.content,
            unsigned: {
                age: 97,
            },
            event_id: "$9999999999999999999999999999999999999999999",
            room_id: event.getRoomId(),
            origin_server_ts: event.getTs(),
        });
        ev.sender = {
            name: ownProfile.displayName || userId,
            rawDisplayName: ownProfile.displayName ?? undefined,
            userId,
            getAvatarUrl: () => ownProfile.avatarUrl,
            getMxcAvatarUrl: () => ownProfile.avatarMxc,
        } as unknown as RoomMember;
        return ev;
    }, [event, ownProfile, userId, vm.content]);

    const previewLayout = useSettingValue("layout");

    return (
        <BaseDialog
            title={_t("common|forward_message")}
            className="mx_ForwardDialog"
            contentId="mx_ForwardList"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <ForwardDialogView
                vm={vm}
                previewClassName={classnames("mx_ForwardDialog_preview", {
                    mx_IRCLayout: previewLayout == Layout.IRC,
                })}
                preview={
                    <EventPresentationContextProvider layout={previewLayout}>
                        <EventTile
                            mxEvent={mockEvent}
                            layout={previewLayout}
                            permalinkCreator={permalinkCreator}
                            as="div"
                            inhibitInteraction
                        />
                    </EventPresentationContextProvider>
                }
            />
        </BaseDialog>
    );
};

export default ForwardDialog;
