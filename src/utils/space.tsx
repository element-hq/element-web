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
import { RoomType, EventType } from "matrix-js-sdk/src/@types/event";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";
import { ICreateRoomStateEvent } from "matrix-js-sdk/src/matrix";

import { calculateRoomVia } from "./permalinks/Permalinks";
import Modal from "../Modal";
import CreateRoomDialog from "../components/views/dialogs/CreateRoomDialog";
import createRoom from "../createRoom";
import { _t } from "../languageHandler";
import SpacePublicShare from "../components/views/spaces/SpacePublicShare";
import InfoDialog from "../components/views/dialogs/InfoDialog";
import { showRoomInviteDialog } from "../RoomInvite";
import CreateSubspaceDialog from "../components/views/dialogs/CreateSubspaceDialog";
import AddExistingSubspaceDialog from "../components/views/dialogs/AddExistingSubspaceDialog";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import Spinner from "../components/views/elements/Spinner";
import { shouldShowComponent } from "../customisations/helpers/UIComponents";
import { UIComponent } from "../settings/UIFeature";
import { OpenSpacePreferencesPayload, SpacePreferenceTab } from "../dispatcher/payloads/OpenSpacePreferencesPayload";
import { OpenSpaceSettingsPayload } from "../dispatcher/payloads/OpenSpaceSettingsPayload";
import { OpenAddExistingToSpaceDialogPayload } from "../dispatcher/payloads/OpenAddExistingToSpaceDialogPayload";
import { SdkContextClass } from "../contexts/SDKContext";

export const shouldShowSpaceSettings = (space: Room): boolean => {
    const userId = space.client.getUserId()!;
    return (
        space.getMyMembership() === "join" &&
        (space.currentState.maySendStateEvent(EventType.RoomAvatar, userId) ||
            space.currentState.maySendStateEvent(EventType.RoomName, userId) ||
            space.currentState.maySendStateEvent(EventType.RoomTopic, userId) ||
            space.currentState.maySendStateEvent(EventType.RoomJoinRules, userId))
    );
};

export const makeSpaceParentEvent = (room: Room, canonical = false): ICreateRoomStateEvent => ({
    type: EventType.SpaceParent,
    content: {
        via: calculateRoomVia(room),
        canonical: canonical,
    },
    state_key: room.roomId,
});

export function showSpaceSettings(space: Room): void {
    defaultDispatcher.dispatch<OpenSpaceSettingsPayload>({
        action: Action.OpenSpaceSettings,
        space,
    });
}

export const showAddExistingRooms = (space: Room): void => {
    defaultDispatcher.dispatch<OpenAddExistingToSpaceDialogPayload>({
        action: Action.OpenAddToExistingSpaceDialog,
        space,
    });
};

export const showCreateNewRoom = async (space: Room, type?: RoomType): Promise<boolean> => {
    const modal = Modal.createDialog(CreateRoomDialog, {
        type,
        defaultPublic: space.getJoinRule() === JoinRule.Public,
        parentSpace: space,
    });
    const [shouldCreate, opts] = await modal.finished;
    if (shouldCreate) {
        await createRoom(space.client, opts);
    }
    return !!shouldCreate;
};

export const shouldShowSpaceInvite = (space: Room): boolean =>
    ((space?.getMyMembership() === "join" && space.canInvite(space.client.getUserId()!)) ||
        space.getJoinRule() === JoinRule.Public) &&
    shouldShowComponent(UIComponent.InviteUsers);

export const showSpaceInvite = (space: Room, initialText = ""): void => {
    if (space.getJoinRule() === "public") {
        const modal = Modal.createDialog(InfoDialog, {
            title: _t("Invite to %(spaceName)s", { spaceName: space.name }),
            description: (
                <React.Fragment>
                    <span>{_t("Share your public space")}</span>
                    <SpacePublicShare space={space} onFinished={() => modal.close()} />
                </React.Fragment>
            ),
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
    Modal.createDialog(
        AddExistingSubspaceDialog,
        {
            space,
            onCreateSubspaceClick: () => showCreateNewSubspace(space),
            onFinished: (added: boolean) => {
                if (added && SdkContextClass.instance.roomViewStore.getRoomId() === space.roomId) {
                    defaultDispatcher.fire(Action.UpdateSpaceHierarchy);
                }
            },
        },
        "mx_AddExistingToSpaceDialog_wrapper",
    );
};

export const showCreateNewSubspace = (space: Room): void => {
    Modal.createDialog(
        CreateSubspaceDialog,
        {
            space,
            onAddExistingSpaceClick: () => showAddExistingSubspace(space),
            onFinished: (added: boolean) => {
                if (added && SdkContextClass.instance.roomViewStore.getRoomId() === space.roomId) {
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
    const modal = Modal.createDialog(Spinner, undefined, "mx_Dialog_spinner");
    try {
        for (const room of children) {
            await fn(room);
        }
        await fn(space);
    } finally {
        modal.close();
    }
};

export const showSpacePreferences = (space: Room, initialTabId?: SpacePreferenceTab): void => {
    defaultDispatcher.dispatch<OpenSpacePreferencesPayload>({
        action: Action.OpenSpacePreferences,
        space,
        initialTabId,
    });
};
