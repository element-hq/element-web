/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

import { logger } from "matrix-js-sdk/src/logger";
import { EventSubscription } from 'fbemitter';

import defaultDispatcher from '../../dispatcher/dispatcher';
import { pendingVerificationRequestForUser } from '../../verification';
import SettingsStore from "../../settings/SettingsStore";
import { RightPanelPhases } from "./RightPanelStorePhases";
import { ActionPayload } from "../../dispatcher/payloads";
import { Action } from '../../dispatcher/actions';
import { SettingLevel } from "../../settings/SettingLevel";
import { UPDATE_EVENT } from '../AsyncStore';
import { ReadyWatchingStore } from '../ReadyWatchingStore';
import {
    IRightPanelCard,
    convertToStatePanel,
    convertToStorePanel,
    IRightPanelForRoom,
    convertCardToStore,
} from './RightPanelStoreIPanelState';
import { MatrixClientPeg } from "../../MatrixClientPeg";
// import RoomViewStore from '../RoomViewStore';

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
 * sessions. This state includes a history for each room. Each history element
 * contains the phase (e.g. RightPanelPhase.RoomMemberInfo) and the state (e.g.
 * the member) associated with it.
 * Groups are treated the same as rooms (they are also stored in the byRoom
 * object). This is possible since the store keeps track of the opened
 * room/group -> the store will provide the correct history for that group/room.
*/
export default class RightPanelStore extends ReadyWatchingStore {
    private static internalInstance: RightPanelStore;
    private viewedRoomId: string;
    private isViewingRoom?: boolean;
    private dispatcherRefRightPanelStore: string;
    private roomStoreToken: EventSubscription;

    private global?: IRightPanelForRoom = null;
    private byRoom: {
        [roomId: string]: IRightPanelForRoom;
    } = {};

    private constructor() {
        super(defaultDispatcher);
        this.dispatcherRefRightPanelStore = defaultDispatcher.register(this.onDispatch);
    }

    protected async onReady(): Promise<any> {
        // TODO RightPanelStore (will be addressed when dropping groups): This should be used instead of the onDispatch callback when groups are removed.
        // RoomViewStore.on(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        MatrixClientPeg.get().on("crypto.verification.request", this.onVerificationRequestUpdate);
        this.loadCacheFromSettings();
        this.emitAndUpdateSettings();
    }
    public destroy() {
        if (this.dispatcherRefRightPanelStore) {
            defaultDispatcher.unregister(this.dispatcherRefRightPanelStore);
        }
        super.destroy();
    }

    protected async onNotReady(): Promise<any> {
        if (this.roomStoreToken) {
            this.roomStoreToken.remove();
        }
        MatrixClientPeg.get().off("crypto.verification.request", this.onVerificationRequestUpdate);
        // TODO RightPanelStore (will be addressed when dropping groups): User this instead of the dispatcher.
        // RoomViewStore.off(UPDATE_EVENT, this.onRoomViewStoreUpdate);
    }

    // Getters
    public get isOpenForRoom(): boolean {
        return this.byRoom[this.viewedRoomId]?.isOpen ?? false;
    }

    public get roomPhaseHistory(): Array<IRightPanelCard> {
        return this.byRoom[this.viewedRoomId]?.history ?? [];
    }

    public get currentCard(): IRightPanelCard {
        const hist = this.roomPhaseHistory;
        if (hist.length >= 1) {
            return hist[hist.length - 1];
        }
        return { state: {}, phase: null };
    }

    public currentCardForRoom(roomId: string): IRightPanelCard {
        const hist = this.byRoom[roomId]?.history ?? [];
        if (hist.length > 0) {
            return hist[hist.length - 1];
        }
        return this.currentCard ?? { state: {}, phase: null };
    }

    public get previousCard(): IRightPanelCard {
        const hist = this.roomPhaseHistory;
        if (hist?.length >= 2) {
            return hist[hist.length - 2];
        }
        return { state: {}, phase: null };
    }

    // The Group associated getters are just for backwards compatibility. Can be removed when deprecating groups.
    public get isOpenForGroup(): boolean { return this.isOpenForRoom; }
    public get groupPhaseHistory(): Array<IRightPanelCard> { return this.roomPhaseHistory; }
    public get currentGroup(): IRightPanelCard { return this.currentCard; }
    public get previousGroup(): IRightPanelCard { return this.previousCard; }

    // Setters
    public setCard(card: IRightPanelCard, allowClose = true, roomId?: string) {
        const rId = roomId ?? this.viewedRoomId;
        // this was previously a very multifunctional command:
        // Toggle panel: if the same phase is send but without a state
        // Update state: if the same phase is send but with a state
        // Set right panel and erase history: if a "different to the current" phase is send (with or without a state)
        const redirect = this.getVerificationRedirect(card);
        const targetPhase = redirect?.phase ?? card.phase;
        const cardState = redirect?.state ?? (Object.keys(card.state ?? {}).length === 0 ? null : card.state);

        // Checks for wrong SetRightPanelPhase requests
        if (!this.isPhaseActionIsValid(targetPhase)) return;

        if (targetPhase === this.currentCard?.phase &&
            allowClose &&
            (this.compareCards({ phase: targetPhase, state: cardState }, this.currentCard) || !cardState)
        ) {
            // Toggle panel: a toggle command needs to fullfil the following:
            // - the same phase
            // - the panel can be closed
            // - does not contain any state information (state)
            if (targetPhase != RightPanelPhases.EncryptionPanel) {
                this.togglePanel(rId);
            }
            return;
        } else if ((targetPhase === this.currentCardForRoom(rId)?.phase && !!cardState)) {
            // Update state: set right panel with a new state but keep the phase (dont know it this is ever needed...)
            const hist = this.byRoom[rId]?.history ?? [];
            hist[hist.length - 1].state = cardState;
            this.emitAndUpdateSettings();
            return;
        } else if (targetPhase !== this.currentCard?.phase) {
            // Set right panel and erase history.
            this.setRightPanelCache({ phase: targetPhase, state: cardState ?? {} }, rId);
        }
    }

    public pushCard(
        card: IRightPanelCard,
        allowClose = true,
        roomId: string = null,
    ) {
        const rId = roomId ?? this.viewedRoomId;
        const redirect = this.getVerificationRedirect(card);
        const targetPhase = redirect?.phase ?? card.phase;
        const pState = redirect?.state ?? (Object.keys(card.state ?? {}).length === 0 ? null : card.state);

        // Checks for wrong SetRightPanelPhase requests
        if (!this.isPhaseActionIsValid(targetPhase)) return;

        let roomCache = this.byRoom[rId];
        if (!!roomCache) {
            // append new phase
            roomCache.history.push({ state: pState, phase: targetPhase });
            roomCache.isOpen = allowClose ? roomCache.isOpen : true;
        } else {
            // setup room panel cache with the new card
            roomCache = {
                history: [{ phase: targetPhase, state: pState ?? {} }],
                // if there was no right panel store object the the panel was closed -> keep it closed, except if allowClose==false
                isOpen: !allowClose,
            };
        }

        this.emitAndUpdateSettings();
    }

    public popCard(roomId: string = null) {
        const rId = roomId ?? this.viewedRoomId;
        if (!this.byRoom[rId]) return;

        const removedCard = this.byRoom[rId].history.pop();
        this.emitAndUpdateSettings();
        return removedCard;
    }

    public togglePanel(roomId: string = null) {
        const rId = roomId ?? this.viewedRoomId;
        if (!this.byRoom[rId]) return;

        this.byRoom[rId].isOpen = !this.byRoom[rId].isOpen;
        this.emitAndUpdateSettings();
    }

    // Private
    private loadCacheFromSettings() {
        const room = this.mxClient?.getRoom(this.viewedRoomId);
        if (!!room) {
            this.global = this.global ??
                convertToStatePanel(SettingsStore.getValue("RightPanel.phasesGlobal"), room);
            this.byRoom[this.viewedRoomId] = this.byRoom[this.viewedRoomId] ??
                convertToStatePanel(SettingsStore.getValue("RightPanel.phases", this.viewedRoomId), room);
        } else {
            console.warn("Could not restore the right panel after load because there was no associated room object." +
                "The right panel can only be restored for rooms and spaces but not for groups");
        }
    }

    private compareCards(a: IRightPanelCard, b: IRightPanelCard): boolean {
        return JSON.stringify(convertCardToStore(a)) == JSON.stringify(convertCardToStore(b));
    }

    private emitAndUpdateSettings() {
        const storePanelGlobal = convertToStorePanel(this.global);
        SettingsStore.setValue("RightPanel.phasesGlobal", null, SettingLevel.DEVICE, storePanelGlobal);

        if (!!this.viewedRoomId) {
            const storePanelThisRoom = convertToStorePanel(this.byRoom[this.viewedRoomId]);
            SettingsStore.setValue(
                "RightPanel.phases",
                this.viewedRoomId,
                SettingLevel.ROOM_DEVICE,
                storePanelThisRoom,
            );
        }
        this.emit(UPDATE_EVENT, null);
    }

    private setRightPanelCache(card: IRightPanelCard, roomId?: string) {
        this.byRoom[roomId ?? this.viewedRoomId] = {
            history: [{ phase: card.phase, state: card.state ?? {} }],
            isOpen: true,
        };
        this.emitAndUpdateSettings();
    }

    private getVerificationRedirect(card: IRightPanelCard): IRightPanelCard {
        if (card.phase === RightPanelPhases.RoomMemberInfo && card.state) {
            // RightPanelPhases.RoomMemberInfo -> needs to be changed to RightPanelPhases.EncryptionPanel if there is a pending verification request
            const { member } = card.state;
            const pendingRequest = pendingVerificationRequestForUser(member);
            if (pendingRequest) {
                return {
                    phase: RightPanelPhases.EncryptionPanel,
                    state: {
                        verificationRequest: pendingRequest,
                        member,
                    },
                };
            }
        }
        return null;
    }

    private isPhaseActionIsValid(targetPhase) {
        if (!RightPanelPhases[targetPhase]) {
            logger.warn(`Tried to switch right panel to unknown phase: ${targetPhase}`);
            return false;
        }
        if (GROUP_PHASES.includes(targetPhase) && this.isViewingRoom) {
            logger.warn(
                `Tried to switch right panel to a group phase: ${targetPhase}, ` +
                `but we are currently not viewing a group`,
            );
            return false;
        } else if (!GROUP_PHASES.includes(targetPhase) && !this.isViewingRoom) {
            logger.warn(
                `Tried to switch right panel to a room phase: ${targetPhase}, ` +
                `but we are currently not viewing a room`,
            );
            return false;
        }
        return true;
    }

    private onVerificationRequestUpdate = () => {
        const { member } = this.currentCard.state;
        const pendingRequest = pendingVerificationRequestForUser(member);
        if (pendingRequest) {
            this.currentCard.state.verificationRequest = pendingRequest;
            this.emitAndUpdateSettings();
        }
    };

    onRoomViewStoreUpdate() {
        // TODO: use this function instead of the onDispatch (the whole onDispatch can get removed!) as soon groups are removed
        // this.viewedRoomId = RoomViewStore.getRoomId();
        // this.isViewingRoom = true; // Is viewing room will of course be removed when removing groups
        // // load values from byRoomCache with the viewedRoomId.
        // this.loadCacheFromSettings();
    }

    onDispatch(payload: ActionPayload) {
        switch (payload.action) {
            case 'view_group':
            case Action.ViewRoom: {
                const _this = RightPanelStore.instance;
                if (payload.room_id === _this.viewedRoomId) break; // skip this transition, probably a permalink

                // Put group in the same/similar view to what was open from the previously viewed room
                // Is contradictory to the new "per room" philosophy but it is the legacy behavior for groups.
                if ((_this.isViewingRoom ? Action.ViewRoom : "view_group") != payload.action) {
                    if (payload.action == Action.ViewRoom && MEMBER_INFO_PHASES.includes(_this.currentCard?.phase)) {
                        // switch from group to room
                        _this.setRightPanelCache({ phase: RightPanelPhases.RoomMemberList, state: {} });
                    } else if (
                        payload.action == "view_group" &&
                        _this.currentCard?.phase === RightPanelPhases.GroupMemberInfo
                    ) {
                        // switch from room to group
                        _this.setRightPanelCache({ phase: RightPanelPhases.GroupMemberList, state: {} });
                    }
                }

                // Update the current room here, so that all the other functions dont need to be room dependant.
                // The right panel store always will return the state for the current room.
                _this.viewedRoomId = payload.room_id;
                _this.isViewingRoom = payload.action == Action.ViewRoom;
                // load values from byRoomCache with the viewedRoomId.
                if (!!_this.roomStoreToken) {
                    // skip loading here since we need the client to be ready to get the events form the ids of the settings
                    // this loading will be done in the onReady function
                    // all the logic in this case is not necessary anymore as soon as groups are dropped and we use: onRoomViewStoreUpdate
                    _this.loadCacheFromSettings();
                    _this.emitAndUpdateSettings();
                }
                break;
            }
        }
    }

    public static get instance(): RightPanelStore {
        if (!RightPanelStore.internalInstance) {
            RightPanelStore.internalInstance = new RightPanelStore();
        }
        return RightPanelStore.internalInstance;
    }
}

window.mxRightPanelStore = RightPanelStore.instance;
