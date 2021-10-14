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
import { Room } from "matrix-js-sdk/src/models/room";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixClient } from "matrix-js-sdk/src/client";

import { calculateRoomVia } from "./permalinks/Permalinks";
import Modal from "../Modal";
import SpaceSettingsDialog from "../components/views/dialogs/SpaceSettingsDialog";
import AddExistingToSpaceDialog from "../components/views/dialogs/AddExistingToSpaceDialog";
import CreateRoomDialog from "../components/views/dialogs/CreateRoomDialog";
import createRoom, { IOpts } from "../createRoom";
import { _t } from "../languageHandler";
import SpacePublicShare from "../components/views/spaces/SpacePublicShare";
import InfoDialog from "../components/views/dialogs/InfoDialog";
import { showRoomInviteDialog } from "../RoomInvite";
import CreateSubspaceDialog from "../components/views/dialogs/CreateSubspaceDialog";
import AddExistingSubspaceDialog from "../components/views/dialogs/AddExistingSubspaceDialog";
import defaultDispatcher from "../dispatcher/dispatcher";
import RoomViewStore from "../stores/RoomViewStore";
import { Action } from "../dispatcher/actions";
import { leaveRoomBehaviour } from "./membership";
import Spinner from "../components/views/elements/Spinner";
import dis from "../dispatcher/dispatcher";
import LeaveSpaceDialog from "../components/views/dialogs/LeaveSpaceDialog";
import CreateSpaceFromCommunityDialog from "../components/views/dialogs/CreateSpaceFromCommunityDialog";

export const shouldShowSpaceSettings = (space: Room) => {
    const userId = space.client.getUserId();
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

export const showSpaceSettings = (space: Room) => {
    Modal.createTrackedDialog("Space Settings", "", SpaceSettingsDialog, {
        matrixClient: space.client,
        space,
    }, /*className=*/null, /*isPriority=*/false, /*isStatic=*/true);
};

export const showAddExistingRooms = (space: Room): void => {
    Modal.createTrackedDialog(
        "Space Landing",
        "Add Existing",
        AddExistingToSpaceDialog,
        {
            onCreateRoomClick: () => showCreateNewRoom(space),
            onAddSubspaceClick: () => showAddExistingSubspace(space),
            space,
            onFinished: (added: boolean) => {
                if (added && RoomViewStore.getRoomId() === space.roomId) {
                    defaultDispatcher.fire(Action.UpdateSpaceHierarchy);
                }
            },
        },
        "mx_AddExistingToSpaceDialog_wrapper",
    );
};

export const showCreateNewRoom = async (space: Room): Promise<boolean> => {
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
    return shouldCreate;
};

export const showSpaceInvite = (space: Room, initialText = ""): void => {
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

export const showAddExistingSubspace = (space: Room): void => {
    Modal.createTrackedDialog(
        "Space Landing",
        "Create Subspace",
        AddExistingSubspaceDialog,
        {
            space,
            onCreateSubspaceClick: () => showCreateNewSubspace(space),
            onFinished: (added: boolean) => {
                if (added && RoomViewStore.getRoomId() === space.roomId) {
                    defaultDispatcher.fire(Action.UpdateSpaceHierarchy);
                }
            },
        },
        "mx_AddExistingToSpaceDialog_wrapper",
    );
};

export const showCreateNewSubspace = (space: Room): void => {
    Modal.createTrackedDialog(
        "Space Landing",
        "Create Subspace",
        CreateSubspaceDialog,
        {
            space,
            onAddExistingSpaceClick: () => showAddExistingSubspace(space),
            onFinished: (added: boolean) => {
                if (added && RoomViewStore.getRoomId() === space.roomId) {
                    defaultDispatcher.fire(Action.UpdateSpaceHierarchy);
                }
            },
        },
        "mx_CreateSubspaceDialog_wrapper",
    );
};

export const bulkSpaceBehaviour = async (
    space: Room,
    children: Room[],
    fn: (room: Room) => Promise<unknown>,
): Promise<void> => {
    const modal = Modal.createDialog(Spinner, null, "mx_Dialog_spinner");
    try {
        for (const room of children) {
            await fn(room);
        }
        await fn(space);
    } finally {
        modal.close();
    }
};

export const leaveSpace = (space: Room) => {
    Modal.createTrackedDialog("Leave Space", "", LeaveSpaceDialog, {
        space,
        onFinished: async (leave: boolean, rooms: Room[]) => {
            if (!leave) return;
            await bulkSpaceBehaviour(space, rooms, room => leaveRoomBehaviour(room.roomId));

            dis.dispatch({
                action: "after_leave_room",
                room_id: space.roomId,
            });
        },
    }, "mx_LeaveSpaceDialog_wrapper");
};

export const createSpaceFromCommunity = (cli: MatrixClient, groupId: string): Promise<[string?]> => {
    return Modal.createTrackedDialog('Create Space', 'from community', CreateSpaceFromCommunityDialog, {
        matrixClient: cli,
        groupId,
    }, "mx_CreateSpaceFromCommunityDialog_wrapper").finished as Promise<[string?]>;
};
