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
import {RIGHT_PANEL_PHASES, RIGHT_PANEL_PHASES_NO_ARGS} from "./RightPanelStorePhases";

const INITIAL_STATE = {
    // Whether or not to show the right panel at all. We split out rooms and groups
    // because they're different flows for the user to follow.
    showRoomPanel: SettingsStore.getValue("showRightPanelInRoom"),
    showGroupPanel: SettingsStore.getValue("showRightPanelInGroup"),

    // The last phase (screen) the right panel was showing
    lastRoomPhase: SettingsStore.getValue("lastRightPanelPhaseForRoom"),
    lastGroupPhase: SettingsStore.getValue("lastRightPanelPhaseForGroup"),

    // Extra information about the last phase
    lastRoomPhaseParams: {},
};

const GROUP_PHASES = Object.keys(RIGHT_PANEL_PHASES).filter(k => k.startsWith("Group"));

const MEMBER_INFO_PHASES = [
    RIGHT_PANEL_PHASES.RoomMemberInfo,
    RIGHT_PANEL_PHASES.Room3pidMemberInfo,
    RIGHT_PANEL_PHASES.EncryptionPanel,
];

/**
 * A class for tracking the state of the right panel between layouts and
 * sessions.
 */
export default class RightPanelStore extends Store {
    static _instance;

    constructor() {
        super(dis);

        // Initialise state
        this._state = INITIAL_STATE;
    }

    get isOpenForRoom(): boolean {
        return this._state.showRoomPanel;
    }

    get isOpenForGroup(): boolean {
        return this._state.showGroupPanel;
    }

    get roomPanelPhase(): string {
        return this._state.lastRoomPhase;
    }

    get groupPanelPhase(): string {
        return this._state.lastGroupPhase;
    }

    get visibleRoomPanelPhase(): string {
        return this.isOpenForRoom ? this.roomPanelPhase : null;
    }

    get visibleGroupPanelPhase(): string {
        return this.isOpenForGroup ? this.groupPanelPhase : null;
    }

    get roomPanelPhaseParams(): any {
        return this._state.lastRoomPhaseParams || {};
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);

        SettingsStore.setValue(
            "showRightPanelInRoom",
            null,
            SettingLevel.DEVICE,
            this._state.showRoomPanel,
        );
        SettingsStore.setValue(
            "showRightPanelInGroup",
            null,
            SettingLevel.DEVICE,
            this._state.showGroupPanel,
        );

        if (RIGHT_PANEL_PHASES_NO_ARGS.includes(this._state.lastRoomPhase)) {
            SettingsStore.setValue(
                "lastRightPanelPhaseForRoom",
                null,
                SettingLevel.DEVICE,
                this._state.lastRoomPhase,
            );
        }
        if (RIGHT_PANEL_PHASES_NO_ARGS.includes(this._state.lastGroupPhase)) {
            SettingsStore.setValue(
                "lastRightPanelPhaseForGroup",
                null,
                SettingLevel.DEVICE,
                this._state.lastGroupPhase,
            );
        }

        this.__emitChange();
    }

    __onDispatch(payload) {
        switch (payload.action) {
            case 'view_room':
            case 'view_group':
                // Reset to the member list if we're viewing member info
                if (MEMBER_INFO_PHASES.includes(this._state.lastRoomPhase)) {
                    this._setState({lastRoomPhase: RIGHT_PANEL_PHASES.RoomMemberList, lastRoomPhaseParams: {}});
                }

                // Do the same for groups
                if (this._state.lastGroupPhase === RIGHT_PANEL_PHASES.GroupMemberInfo) {
                    this._setState({lastGroupPhase: RIGHT_PANEL_PHASES.GroupMemberList});
                }
                break;

            case 'set_right_panel_phase': {
                let targetPhase = payload.phase;
                let refireParams = payload.refireParams;
                // redirect to EncryptionPanel if there is an ongoing verification request
                if (targetPhase === RIGHT_PANEL_PHASES.RoomMemberInfo && payload.refireParams) {
                    const {member} = payload.refireParams;
                    const pendingRequest = pendingVerificationRequestForUser(member);
                    if (pendingRequest) {
                        targetPhase = RIGHT_PANEL_PHASES.EncryptionPanel;
                        refireParams = {
                            verificationRequest: pendingRequest,
                            member,
                        };
                    }
                }
                if (!RIGHT_PANEL_PHASES[targetPhase]) {
                    console.warn(`Tried to switch right panel to unknown phase: ${targetPhase}`);
                    return;
                }

                if (GROUP_PHASES.includes(targetPhase)) {
                    if (targetPhase === this._state.lastGroupPhase) {
                        this._setState({
                            showGroupPanel: !this._state.showGroupPanel,
                        });
                    } else {
                        this._setState({
                            lastGroupPhase: targetPhase,
                            showGroupPanel: true,
                        });
                    }
                } else {
                    if (targetPhase === this._state.lastRoomPhase && !refireParams) {
                        this._setState({
                            showRoomPanel: !this._state.showRoomPanel,
                        });
                    } else {
                        this._setState({
                            lastRoomPhase: targetPhase,
                            showRoomPanel: true,
                            lastRoomPhaseParams: refireParams || {},
                        });
                    }
                }

                // Let things like the member info panel actually open to the right member.
                dis.dispatch({
                    action: 'after_right_panel_phase_change',
                    phase: targetPhase,
                    ...(refireParams || {}),
                });
                break;
            }

            case 'toggle_right_panel':
                if (payload.type === "room") {
                    this._setState({ showRoomPanel: !this._state.showRoomPanel });
                } else { // group
                    this._setState({ showGroupPanel: !this._state.showGroupPanel });
                }
                break;
        }
    }

    static getSharedInstance(): RightPanelStore {
        if (!RightPanelStore._instance) {
            RightPanelStore._instance = new RightPanelStore();
        }
        return RightPanelStore._instance;
    }
}
