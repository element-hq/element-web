/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentProps, useMemo, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import ConfirmUserActionDialog from "./ConfirmUserActionDialog";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import SpaceChildrenPicker from "../spaces/SpaceChildrenPicker";

type BaseProps = ComponentProps<typeof ConfirmUserActionDialog>;
interface IProps extends Omit<BaseProps, "matrixClient" | "children" | "onFinished"> {
    space: Room;
    allLabel: string;
    specificLabel: string;
    noneLabel?: string;
    warningMessage?: string;
    onFinished(success?: boolean, reason?: string, rooms?: Room[]): void;
    spaceChildFilter?(child: Room): boolean;
}

const ConfirmSpaceUserActionDialog: React.FC<IProps> = ({
    space,
    spaceChildFilter,
    allLabel,
    specificLabel,
    noneLabel,
    warningMessage,
    onFinished,
    ...props
}) => {
    const spaceChildren = useMemo(() => {
        const children = SpaceStore.instance.getChildren(space.roomId);
        if (spaceChildFilter) {
            return children.filter(spaceChildFilter);
        }
        return children;
    }, [space.roomId, spaceChildFilter]);

    const [roomsToLeave, setRoomsToLeave] = useState<Room[]>([]);
    const selectedRooms = useMemo(() => new Set(roomsToLeave), [roomsToLeave]);

    let warning: JSX.Element | undefined;
    if (warningMessage) {
        warning = <div className="mx_ConfirmSpaceUserActionDialog_warning">{warningMessage}</div>;
    }

    return (
        <ConfirmUserActionDialog
            {...props}
            onFinished={(success?: boolean, reason?: string) => {
                onFinished(success, reason, roomsToLeave);
            }}
            className="mx_ConfirmSpaceUserActionDialog"
            roomId={space.roomId}
        >
            {warning}
            <SpaceChildrenPicker
                space={space}
                spaceChildren={spaceChildren}
                selected={selectedRooms}
                allLabel={allLabel}
                specificLabel={specificLabel}
                noneLabel={noneLabel}
                onChange={setRoomsToLeave}
            />
        </ConfirmUserActionDialog>
    );
};

export default ConfirmSpaceUserActionDialog;
