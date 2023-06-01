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

import React, { ComponentProps, useMemo, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";

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
