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

import React from "react";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixClient} from "matrix-js-sdk/src/client";
import {EventType} from "matrix-js-sdk/src/@types/event";

import {calculateRoomVia} from "../utils/permalinks/Permalinks";
import Modal from "../Modal";
import SpaceSettingsDialog from "../components/views/dialogs/SpaceSettingsDialog";
import AddExistingToSpaceDialog from "../components/views/dialogs/AddExistingToSpaceDialog";
import CreateRoomDialog from "../components/views/dialogs/CreateRoomDialog";
import createRoom, {IOpts} from "../createRoom";
import {_t} from "../languageHandler";
import SpacePublicShare from "../components/views/spaces/SpacePublicShare";
import InfoDialog from "../components/views/dialogs/InfoDialog";
import { showRoomInviteDialog } from "../RoomInvite";

export const shouldShowSpaceSettings = (cli: MatrixClient, space: Room) => {
    const userId = cli.getUserId();
    return space.getMyMembership() === "join"
        && (space.currentState.maySendStateEvent(EventType.RoomAvatar, userId)
            || space.currentState.maySendStateEvent(EventType.RoomName, userId)
            || space.currentState.maySendStateEvent(EventType.RoomTopic, userId)
            || space.currentState.maySendStateEvent(EventType.RoomJoinRules, userId));
};

export const makeSpaceParentEvent = (room: Room, canonical = false) => ({
    type: EventType.SpaceParent,
    content: {
        "via": calculateRoomVia(room),
        "canonical": canonical,
    },
    state_key: room.roomId,
});

export const showSpaceSettings = (cli: MatrixClient, space: Room) => {
    Modal.createTrackedDialog("Space Settings", "", SpaceSettingsDialog, {
        matrixClient: cli,
        space,
    }, /*className=*/null, /*isPriority=*/false, /*isStatic=*/true);
};

export const showAddExistingRooms = async (cli: MatrixClient, space: Room) => {
    return Modal.createTrackedDialog(
        "Space Landing",
        "Add Existing",
        AddExistingToSpaceDialog,
        {
            matrixClient: cli,
            onCreateRoomClick: showCreateNewRoom,
            space,
        },
        "mx_AddExistingToSpaceDialog_wrapper",
    ).finished;
};

export const showCreateNewRoom = async (cli: MatrixClient, space: Room) => {
    const modal = Modal.createTrackedDialog<[boolean, IOpts]>(
        "Space Landing",
        "Create Room",
        CreateRoomDialog,
        {
            defaultPublic: space.getJoinRule() === "public",
            parentSpace: space,
        },
    );
    const [shouldCreate, opts] = await modal.finished;
    if (shouldCreate) {
        await createRoom(opts);
    }
};

export const showSpaceInvite = (space: Room, initialText = "") => {
    if (space.getJoinRule() === "public") {
        const modal = Modal.createTrackedDialog("Space Invite", "User Menu", InfoDialog, {
            title: _t("Invite to %(spaceName)s", { spaceName: space.name }),
            description: <React.Fragment>
                <span>{ _t("Share your public space") }</span>
                <SpacePublicShare space={space} onFinished={() => modal.close()} />
            </React.Fragment>,
            fixedWidth: false,
            button: false,
            className: "mx_SpacePanel_sharePublicSpace",
            hasCloseButton: true,
        });
    } else {
        showRoomInviteDialog(space.roomId, initialText);
    }
};
