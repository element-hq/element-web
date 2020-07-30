/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import dis from '../dispatcher/dispatcher';
import {pendingVerificationRequestForUser} from '../verification';
import {Store} from 'flux/utils';
import SettingsStore, {SettingLevel} from "../settings/SettingsStore";
import {RightPanelPhases, RIGHT_PANEL_PHASES_NO_ARGS} from "./RightPanelStorePhases";
import {ActionPayload} from "../dispatcher/payloads";
import {Action} from '../dispatcher/actions';

interface RightPanelStoreState {
    // Whether or not to show the right panel at all. We split out rooms and groups
    // because they're different flows for the user to follow.
    showRoomPanel: boolean;
    showGroupPanel: boolean;

    // The last phase (screen) the right panel was showing
    lastRoomPhase: RightPanelPhases;
    lastGroupPhase: RightPanelPhases;

    // Extra information about the last phase
    lastRoomPhaseParams: {[key: string]: any};
}

const INITIAL_STATE: RightPanelStoreState = {
    showRoomPanel: SettingsStore.getValue("showRightPanelInRoom"),
    showGroupPanel: SettingsStore.getValue("showRightPanelInGroup"),
    lastRoomPhase: SettingsStore.getValue("lastRightPanelPhaseForRoom"),
    lastGroupPhase: SettingsStore.getValue("lastRightPanelPhaseForGroup"),
    lastRoomPhaseParams: {},
};

const GROUP_PHASES = [
    RightPanelPhases.GroupMemberList,
    RightPanelPhases.GroupRoomList,
    RightPanelPhases.GroupRoomInfo,
    RightPanelPhases.GroupMemberInfo,
];

const MEMBER_INFO_PHASES = [
    RightPanelPhases.RoomMemberInfo,
    RightPanelPhases.Room3pidMemberInfo,
    RightPanelPhases.EncryptionPanel,
];

/**
 * A class for tracking the state of the right panel between layouts and
 * sessions.
 */
export default class RightPanelStore extends Store<ActionPayload> {
    private static instance: RightPanelStore;
    private state: RightPanelStoreState;

    constructor() {
        super(dis);

        // Initialise state
        this.state = INITIAL_STATE;
    }

    get isOpenForRoom(): boolean {
        return this.state.showRoomPanel;
    }

    get isOpenForGroup(): boolean {
        return this.state.showGroupPanel;
    }

    get roomPanelPhase(): RightPanelPhases {
        return this.state.lastRoomPhase;
    }

    get groupPanelPhase(): RightPanelPhases {
        return this.state.lastGroupPhase;
    }

    get visibleRoomPanelPhase(): RightPanelPhases {
        return this.isOpenForRoom ? this.roomPanelPhase : null;
    }

    get visibleGroupPanelPhase(): RightPanelPhases {
        return this.isOpenForGroup ? this.groupPanelPhase : null;
    }

    get roomPanelPhaseParams(): any {
        return this.state.lastRoomPhaseParams || {};
    }

    private setState(newState: Partial<RightPanelStoreState>) {
        this.state = Object.assign(this.state, newState);

        SettingsStore.setValue(
            "showRightPanelInRoom",
            null,
            SettingLevel.DEVICE,
            this.state.showRoomPanel,
        );
        SettingsStore.setValue(
            "showRightPanelInGroup",
            null,
            SettingLevel.DEVICE,
            this.state.showGroupPanel,
        );

        if (RIGHT_PANEL_PHASES_NO_ARGS.includes(this.state.lastRoomPhase)) {
            SettingsStore.setValue(
                "lastRightPanelPhaseForRoom",
                null,
                SettingLevel.DEVICE,
                this.state.lastRoomPhase,
            );
        }
        if (RIGHT_PANEL_PHASES_NO_ARGS.includes(this.state.lastGroupPhase)) {
            SettingsStore.setValue(
                "lastRightPanelPhaseForGroup",
                null,
                SettingLevel.DEVICE,
                this.state.lastGroupPhase,
            );
        }

        this.__emitChange();
    }

    __onDispatch(payload: ActionPayload) {
        switch (payload.action) {
            case 'view_room':
            case 'view_group':
                // Reset to the member list if we're viewing member info
                if (MEMBER_INFO_PHASES.includes(this.state.lastRoomPhase)) {
                    this.setState({lastRoomPhase: RightPanelPhases.RoomMemberList, lastRoomPhaseParams: {}});
                }

                // Do the same for groups
                if (this.state.lastGroupPhase === RightPanelPhases.GroupMemberInfo) {
                    this.setState({lastGroupPhase: RightPanelPhases.GroupMemberList});
                }
                break;

            case Action.SetRightPanelPhase: {
                let targetPhase = payload.phase;
                let refireParams = payload.refireParams;
                // redirect to EncryptionPanel if there is an ongoing verification request
                if (targetPhase === RightPanelPhases.RoomMemberInfo && payload.refireParams) {
                    const {member} = payload.refireParams;
                    const pendingRequest = pendingVerificationRequestForUser(member);
                    if (pendingRequest) {
                        targetPhase = RightPanelPhases.EncryptionPanel;
                        refireParams = {
                            verificationRequest: pendingRequest,
                            member,
                        };
                    }
                }
                if (!RightPanelPhases[targetPhase]) {
                    console.warn(`Tried to switch right panel to unknown phase: ${targetPhase}`);
                    return;
                }

                if (GROUP_PHASES.includes(targetPhase)) {
                    if (targetPhase === this.state.lastGroupPhase) {
                        this.setState({
                            showGroupPanel: !this.state.showGroupPanel,
                        });
                    } else {
                        this.setState({
                            lastGroupPhase: targetPhase,
                            showGroupPanel: true,
                        });
                    }
                } else {
                    if (targetPhase === this.state.lastRoomPhase && !refireParams) {
                        this.setState({
                            showRoomPanel: !this.state.showRoomPanel,
                        });
                    } else {
                        this.setState({
                            lastRoomPhase: targetPhase,
                            showRoomPanel: true,
                            lastRoomPhaseParams: refireParams || {},
                        });
                    }
                }

                // Let things like the member info panel actually open to the right member.
                dis.dispatch({
                    action: Action.AfterRightPanelPhaseChange,
                    phase: targetPhase,
                    ...(refireParams || {}),
                });
                break;
            }

            case Action.ToggleRightPanel:
                if (payload.type === "room") {
                    this.setState({ showRoomPanel: !this.state.showRoomPanel });
                } else { // group
                    this.setState({ showGroupPanel: !this.state.showGroupPanel });
                }
                break;
        }
    }

    static getSharedInstance(): RightPanelStore {
        if (!RightPanelStore.instance) {
            RightPanelStore.instance = new RightPanelStore();
        }
        return RightPanelStore.instance;
    }
}
