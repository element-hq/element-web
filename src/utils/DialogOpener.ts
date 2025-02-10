/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classnames from "classnames";
import { type ComponentProps } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import defaultDispatcher from "../dispatcher/dispatcher";
import { type ActionPayload } from "../dispatcher/payloads";
import Modal from "../Modal";
import RoomSettingsDialog from "../components/views/dialogs/RoomSettingsDialog";
import ForwardDialog from "../components/views/dialogs/ForwardDialog";
import { Action } from "../dispatcher/actions";
import ReportEventDialog from "../components/views/dialogs/ReportEventDialog";
import SpacePreferencesDialog from "../components/views/dialogs/SpacePreferencesDialog";
import SpaceSettingsDialog from "../components/views/dialogs/SpaceSettingsDialog";
import InviteDialog from "../components/views/dialogs/InviteDialog";
import AddExistingToSpaceDialog from "../components/views/dialogs/AddExistingToSpaceDialog";
import { type ButtonEvent } from "../components/views/elements/AccessibleButton";
import PosthogTrackers from "../PosthogTrackers";
import { showAddExistingSubspace, showCreateNewRoom } from "./space";
import { SdkContextClass } from "../contexts/SDKContext";

/**
 * Auxiliary class to listen for dialog opening over the dispatcher and
 * open the required dialogs. Not all dialogs run through here, but the
 * ones which cause import cycles are good candidates.
 */
export class DialogOpener {
    public static readonly instance = new DialogOpener();

    private isRegistered = false;
    private matrixClient?: MatrixClient;

    private constructor() {}

    // We could do this in the constructor, but then we wouldn't have
    // a function to call from Lifecycle to capture the class.
    public prepare(matrixClient: MatrixClient): void {
        this.matrixClient = matrixClient;
        if (this.isRegistered) return;
        defaultDispatcher.register(this.onDispatch);
        this.isRegistered = true;
    }

    private onDispatch = (payload: ActionPayload): void => {
        if (!this.matrixClient) return;
        switch (payload.action) {
            case "open_room_settings":
                Modal.createDialog(
                    RoomSettingsDialog,
                    {
                        roomId: payload.room_id || SdkContextClass.instance.roomViewStore.getRoomId(),
                        initialTabId: payload.initial_tab_id,
                    },
                    /*className=*/ undefined,
                    /*isPriority=*/ false,
                    /*isStatic=*/ true,
                );
                break;
            case Action.OpenForwardDialog:
                Modal.createDialog(ForwardDialog, {
                    matrixClient: this.matrixClient,
                    event: payload.event,
                    permalinkCreator: payload.permalinkCreator,
                });
                break;
            case Action.OpenReportEventDialog:
                Modal.createDialog(
                    ReportEventDialog,
                    {
                        mxEvent: payload.event,
                    },
                    "mx_Dialog_reportEvent",
                );
                break;
            case Action.OpenSpacePreferences:
                Modal.createDialog(
                    SpacePreferencesDialog,
                    {
                        space: payload.space,
                    },
                    undefined,
                    false,
                    true,
                );
                break;
            case Action.OpenSpaceSettings:
                Modal.createDialog(
                    SpaceSettingsDialog,
                    {
                        matrixClient: payload.space.client,
                        space: payload.space,
                    },
                    /*className=*/ undefined,
                    /*isPriority=*/ false,
                    /*isStatic=*/ true,
                );
                break;
            case Action.OpenInviteDialog:
                Modal.createDialog(
                    InviteDialog,
                    {
                        kind: payload.kind,
                        call: payload.call,
                        roomId: payload.roomId,
                    } as Omit<ComponentProps<typeof InviteDialog>, "onFinished">,
                    classnames("mx_InviteDialog_flexWrapper", payload.className),
                    false,
                    true,
                ).finished.then((results) => {
                    payload.onFinishedCallback?.(results);
                });
                break;
            case Action.OpenAddToExistingSpaceDialog: {
                const space = payload.space;
                Modal.createDialog(
                    AddExistingToSpaceDialog,
                    {
                        onCreateRoomClick: (ev: ButtonEvent) => {
                            showCreateNewRoom(space);
                            PosthogTrackers.trackInteraction("WebAddExistingToSpaceDialogCreateRoomButton", ev);
                        },
                        onAddSubspaceClick: () => showAddExistingSubspace(space),
                        space,
                        onFinished: (added: boolean) => {
                            if (added && SdkContextClass.instance.roomViewStore.getRoomId() === space.roomId) {
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
