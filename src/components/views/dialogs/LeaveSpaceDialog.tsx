/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo, useState } from "react";
import { type Room, JoinRule } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import DialogButtons from "../elements/DialogButtons";
import BaseDialog from "../dialogs/BaseDialog";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import SpaceChildrenPicker from "../spaces/SpaceChildrenPicker";
import { filterBoolean } from "../../../utils/arrays";

interface IProps {
    space: Room;
    onFinished(leave: boolean, rooms?: Room[]): void;
}

const isOnlyAdmin = (room: Room): boolean => {
    const userId = room.client.getSafeUserId();
    if (room.getMember(userId)?.powerLevelNorm !== 100) {
        return false; // user is not an admin
    }
    return room.getJoinedMembers().every((member) => {
        // return true if every other member has a lower power level (we are highest)
        return member.userId === userId || member.powerLevelNorm < 100;
    });
};

const LeaveSpaceDialog: React.FC<IProps> = ({ space, onFinished }) => {
    const spaceChildren = useMemo(() => {
        const roomSet = new Set(SpaceStore.instance.getSpaceFilteredRoomIds(space.roomId));
        SpaceStore.instance.traverseSpace(
            space.roomId,
            (spaceId) => {
                if (space.roomId === spaceId) return; // skip the root node
                roomSet.add(spaceId);
            },
            false,
        );
        return filterBoolean(Array.from(roomSet).map((roomId) => space.client.getRoom(roomId)));
    }, [space]);
    const [roomsToLeave, setRoomsToLeave] = useState<Room[]>([]);
    const selectedRooms = useMemo(() => new Set(roomsToLeave), [roomsToLeave]);

    let rejoinWarning;
    if (space.getJoinRule() !== JoinRule.Public) {
        rejoinWarning = _t("space|leave_dialog_public_rejoin_warning");
    }

    let onlyAdminWarning;
    if (isOnlyAdmin(space)) {
        onlyAdminWarning = _t("space|leave_dialog_only_admin_warning");
    } else {
        const numChildrenOnlyAdminIn = roomsToLeave.filter(isOnlyAdmin).length;
        if (numChildrenOnlyAdminIn > 0) {
            onlyAdminWarning = _t("space|leave_dialog_only_admin_room_warning");
        }
    }

    return (
        <BaseDialog
            title={_t("space|leave_dialog_title", { spaceName: space.name })}
            className="mx_LeaveSpaceDialog"
            contentId="mx_LeaveSpaceDialog"
            onFinished={() => onFinished(false)}
            fixedWidth={false}
        >
            <div className="mx_Dialog_content" id="mx_LeaveSpaceDialog">
                <p>
                    {_t(
                        "space|leave_dialog_description",
                        {},
                        {
                            spaceName: () => <strong>{space.name}</strong>,
                        },
                    )}
                    &nbsp;
                    {rejoinWarning}
                    {rejoinWarning && <>&nbsp;</>}
                    {spaceChildren.length > 0 && _t("space|leave_dialog_option_intro")}
                </p>

                {spaceChildren.length > 0 && (
                    <SpaceChildrenPicker
                        space={space}
                        spaceChildren={spaceChildren}
                        selected={selectedRooms}
                        onChange={setRoomsToLeave}
                        noneLabel={_t("space|leave_dialog_option_none")}
                        allLabel={_t("space|leave_dialog_option_all")}
                        specificLabel={_t("space|leave_dialog_option_specific")}
                    />
                )}

                {onlyAdminWarning && <div className="mx_LeaveSpaceDialog_section_warning">{onlyAdminWarning}</div>}
            </div>
            <DialogButtons
                primaryButton={_t("space|leave_dialog_action")}
                primaryButtonClass="danger"
                onPrimaryButtonClick={() => onFinished(true, roomsToLeave)}
                hasCancel={true}
                onCancel={() => onFinished(false)}
            />
        </BaseDialog>
    );
};

export default LeaveSpaceDialog;
