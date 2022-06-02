/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import classnames from "classnames";

import defaultDispatcher from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import Modal from "../Modal";
import RoomSettingsDialog from "../components/views/dialogs/RoomSettingsDialog";
import { RoomViewStore } from "../stores/RoomViewStore";
import ForwardDialog from "../components/views/dialogs/ForwardDialog";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { Action } from "../dispatcher/actions";
import ReportEventDialog from "../components/views/dialogs/ReportEventDialog";
import SpacePreferencesDialog from "../components/views/dialogs/SpacePreferencesDialog";
import SpaceSettingsDialog from "../components/views/dialogs/SpaceSettingsDialog";
import InviteDialog from "../components/views/dialogs/InviteDialog";
import AddExistingToSpaceDialog from "../components/views/dialogs/AddExistingToSpaceDialog";
import { ButtonEvent } from "../components/views/elements/AccessibleButton";
import PosthogTrackers from "../PosthogTrackers";
import { showAddExistingSubspace, showCreateNewRoom } from "./space";

/**
 * Auxiliary class to listen for dialog opening over the dispatcher and
 * open the required dialogs. Not all dialogs run through here, but the
 * ones which cause import cycles are good candidates.
 */
export class DialogOpener {
    public static readonly instance = new DialogOpener();

    private isRegistered = false;

    private constructor() {
    }

    // We could do this in the constructor, but then we wouldn't have
    // a function to call from Lifecycle to capture the class.
    public prepare() {
        if (this.isRegistered) return;
        defaultDispatcher.register(this.onDispatch);
        this.isRegistered = true;
    }

    private onDispatch = (payload: ActionPayload) => {
        switch (payload.action) {
            case 'open_room_settings':
                Modal.createTrackedDialog('Room settings', '', RoomSettingsDialog, {
                    roomId: payload.room_id || RoomViewStore.instance.getRoomId(),
                    initialTabId: payload.initial_tab_id,
                }, /*className=*/null, /*isPriority=*/false, /*isStatic=*/true);
                break;
            case Action.OpenForwardDialog:
                Modal.createTrackedDialog('Forward Message', '', ForwardDialog, {
                    matrixClient: MatrixClientPeg.get(),
                    event: payload.event,
                    permalinkCreator: payload.permalinkCreator,
                });
                break;
            case Action.OpenReportEventDialog:
                Modal.createTrackedDialog('Report Event', '', ReportEventDialog, {
                    mxEvent: payload.event,
                }, 'mx_Dialog_reportEvent');
                break;
            case Action.OpenSpacePreferences:
                Modal.createTrackedDialog("Space preferences", "", SpacePreferencesDialog, {
                    initialTabId: payload.initalTabId,
                    space: payload.space,
                }, null, false, true);
                break;
            case Action.OpenSpaceSettings:
                Modal.createTrackedDialog("Space Settings", "", SpaceSettingsDialog, {
                    matrixClient: payload.space.client,
                    space: payload.space,
                }, /*className=*/null, /*isPriority=*/false, /*isStatic=*/true);
                break;
            case Action.OpenInviteDialog:
                Modal.createTrackedDialog(payload.analyticsName, '', InviteDialog, {
                    kind: payload.kind,
                    call: payload.call,
                    roomId: payload.roomId,
                }, classnames("mx_InviteDialog_flexWrapper", payload.className), false, true).finished
                    .then((results) => {
                        payload.onFinishedCallback?.(results);
                    });
                break;
            case Action.OpenAddToExistingSpaceDialog: {
                const space = payload.space;
                Modal.createTrackedDialog(
                    "Space Landing",
                    "Add Existing",
                    AddExistingToSpaceDialog,
                    {
                        onCreateRoomClick: (ev: ButtonEvent) => {
                            showCreateNewRoom(space);
                            PosthogTrackers.trackInteraction("WebAddExistingToSpaceDialogCreateRoomButton", ev);
                        },
                        onAddSubspaceClick: () => showAddExistingSubspace(space),
                        space,
                        onFinished: (added: boolean) => {
                            if (added && RoomViewStore.instance.getRoomId() === space.roomId) {
                                defaultDispatcher.fire(Action.UpdateSpaceHierarchy);
                            }
                        },
                    },
                    "mx_AddExistingToSpaceDialog_wrapper",
                );
                break;
            }
        }
    };
}
