/*
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

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
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { Optional } from "matrix-events-sdk";

import defaultDispatcher from "../../dispatcher/dispatcher";
import { pendingVerificationRequestForUser } from "../../verification";
import SettingsStore from "../../settings/SettingsStore";
import { RightPanelPhases } from "./RightPanelStorePhases";
import { SettingLevel } from "../../settings/SettingLevel";
import { UPDATE_EVENT } from "../AsyncStore";
import { ReadyWatchingStore } from "../ReadyWatchingStore";
import {
    convertToStatePanel,
    convertToStorePanel,
    IRightPanelCard,
    IRightPanelForRoom,
} from "./RightPanelStoreIPanelState";
import { ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";
import { ActiveRoomChangedPayload } from "../../dispatcher/payloads/ActiveRoomChangedPayload";
import { SdkContextClass } from "../../contexts/SDKContext";
import { MatrixClientPeg } from "../../MatrixClientPeg";

/**
 * A class for tracking the state of the right panel between layouts and
 * sessions. This state includes a history for each room. Each history element
 * contains the phase (e.g. RightPanelPhase.RoomMemberInfo) and the state (e.g.
 * the member) associated with it.
 */
export default class RightPanelStore extends ReadyWatchingStore {
    private static internalInstance: RightPanelStore;

    private global?: IRightPanelForRoom;
    private byRoom: { [roomId: string]: IRightPanelForRoom };
    private viewedRoomId: Optional<string>;

    private constructor() {
        super(defaultDispatcher);
        this.reset();
    }

    /**
     * Resets the store. Intended for test usage only.
     */
    public reset(): void {
        this.global = undefined;
        this.byRoom = {};
        this.viewedRoomId = null;
    }

    protected async onReady(): Promise<any> {
        this.viewedRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
        this.matrixClient?.on(CryptoEvent.VerificationRequest, this.onVerificationRequestUpdate);
        this.loadCacheFromSettings();
        this.emitAndUpdateSettings();
    }

    protected async onNotReady(): Promise<any> {
        this.matrixClient?.off(CryptoEvent.VerificationRequest, this.onVerificationRequestUpdate);
    }

    protected onDispatcherAction(payload: ActionPayload): void {
        if (payload.action !== Action.ActiveRoomChanged) return;

        const changePayload = <ActiveRoomChangedPayload>payload;
        this.handleViewedRoomChange(changePayload.oldRoomId, changePayload.newRoomId);
    }

    // Getters
    /**
     * If you are calling this from a component that already knows about a
     * specific room from props / state, then it's best to prefer
     * `isOpenForRoom` below to ensure all your data is for a single room
     * during room changes.
     */
    public get isOpen(): boolean {
        return this.byRoom[this.viewedRoomId]?.isOpen ?? false;
    }

    public isOpenForRoom(roomId: string): boolean {
        return this.byRoom[roomId]?.isOpen ?? false;
    }

    public get roomPhaseHistory(): Array<IRightPanelCard> {
        return this.byRoom[this.viewedRoomId]?.history ?? [];
    }

    /**
     * If you are calling this from a component that already knows about a
     * specific room from props / state, then it's best to prefer
     * `currentCardForRoom` below to ensure all your data is for a single room
     * during room changes.
     */
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
        return { state: {}, phase: null };
    }

    public get previousCard(): IRightPanelCard {
        const hist = this.roomPhaseHistory;
        if (hist?.length >= 2) {
            return hist[hist.length - 2];
        }
        return { state: {}, phase: null };
    }

    // Setters
    public setCard(card: IRightPanelCard, allowClose = true, roomId?: string): void {
        const rId = roomId ?? this.viewedRoomId;
        // This function behaves as following:
        // Update state: if the same phase is send but with a state
        // Set right panel and erase history: if a "different to the current" phase is send (with or without a state)
        // If the right panel is set, this function also shows the right panel.
        const redirect = this.getVerificationRedirect(card);
        const targetPhase = redirect?.phase ?? card.phase;
        const cardState = redirect?.state ?? (Object.keys(card.state ?? {}).length === 0 ? null : card.state);

        // Checks for wrong SetRightPanelPhase requests
        if (!this.isPhaseValid(targetPhase, Boolean(rId))) return;

        if (targetPhase === this.currentCardForRoom(rId)?.phase && !!cardState) {
            // Update state: set right panel with a new state but keep the phase (don't know it this is ever needed...)
            const hist = this.byRoom[rId]?.history ?? [];
            hist[hist.length - 1].state = cardState;
            this.emitAndUpdateSettings();
        } else if (targetPhase !== this.currentCardForRoom(rId)?.phase || !this.byRoom[rId]) {
            // Set right panel and initialize/erase history
            const history = [{ phase: targetPhase, state: cardState ?? {} }];
            this.byRoom[rId] = { history, isOpen: true };
            this.emitAndUpdateSettings();
        } else {
            this.show(rId);
            this.emitAndUpdateSettings();
        }
    }

    public setCards(cards: IRightPanelCard[], allowClose = true, roomId: string | null = null): void {
        // This function sets the history of the right panel and shows the right panel if not already visible.
        const rId = roomId ?? this.viewedRoomId;
        const history = cards.map((c) => ({ phase: c.phase, state: c.state ?? {} }));
        this.byRoom[rId] = { history, isOpen: true };
        this.show(rId);
        this.emitAndUpdateSettings();
    }

    // Appends a card to the history and shows the right panel if not already visible
    public pushCard(card: IRightPanelCard, allowClose = true, roomId: string | null = null): void {
        const rId = roomId ?? this.viewedRoomId;
        const redirect = this.getVerificationRedirect(card);
        const targetPhase = redirect?.phase ?? card.phase;
        const pState = redirect?.state ?? card.state ?? {};

        // Checks for wrong SetRightPanelPhase requests
        if (!this.isPhaseValid(targetPhase, Boolean(rId))) return;

        const roomCache = this.byRoom[rId];
        if (!!roomCache) {
            // append new phase
            roomCache.history.push({ state: pState, phase: targetPhase });
            roomCache.isOpen = allowClose ? roomCache.isOpen : true;
        } else {
            // setup room panel cache with the new card
            this.byRoom[rId] = {
                history: [{ phase: targetPhase, state: pState }],
                // if there was no right panel store object the the panel was closed -> keep it closed, except if allowClose==false
                isOpen: !allowClose,
            };
        }
        this.show(rId);
        this.emitAndUpdateSettings();
    }

    public popCard(roomId: string | null = null): IRightPanelCard | undefined {
        const rId = roomId ?? this.viewedRoomId;
        if (!this.byRoom[rId]) return;

        const removedCard = this.byRoom[rId].history.pop();
        this.emitAndUpdateSettings();
        return removedCard;
    }

    public togglePanel(roomId: string | null): void {
        const rId = roomId ?? this.viewedRoomId;
        if (!this.byRoom[rId]) return;

        this.byRoom[rId].isOpen = !this.byRoom[rId].isOpen;
        this.emitAndUpdateSettings();
    }

    public show(roomId: string | null): void {
        if (!this.isOpenForRoom(roomId ?? this.viewedRoomId)) {
            this.togglePanel(roomId);
        }
    }

    public hide(roomId: string | null): void {
        if (this.isOpenForRoom(roomId ?? this.viewedRoomId)) {
            this.togglePanel(roomId);
        }
    }

    private loadCacheFromSettings(): void {
        if (this.viewedRoomId) {
            const room = this.mxClient?.getRoom(this.viewedRoomId);
            if (!!room) {
                this.global =
                    this.global ?? convertToStatePanel(SettingsStore.getValue("RightPanel.phasesGlobal"), room);
                this.byRoom[this.viewedRoomId] =
                    this.byRoom[this.viewedRoomId] ??
                    convertToStatePanel(SettingsStore.getValue("RightPanel.phases", this.viewedRoomId), room);
            } else {
                logger.warn(
                    "Could not restore the right panel after load because there was no associated room object.",
                );
            }
        }
    }

    private emitAndUpdateSettings(): void {
        this.filterValidCards(this.global);
        const storePanelGlobal = convertToStorePanel(this.global);
        SettingsStore.setValue("RightPanel.phasesGlobal", null, SettingLevel.DEVICE, storePanelGlobal);

        if (!!this.viewedRoomId) {
            const panelThisRoom = this.byRoom[this.viewedRoomId];
            this.filterValidCards(panelThisRoom);
            const storePanelThisRoom = convertToStorePanel(panelThisRoom);
            SettingsStore.setValue(
                "RightPanel.phases",
                this.viewedRoomId,
                SettingLevel.ROOM_DEVICE,
                storePanelThisRoom,
            );
        }
        this.emit(UPDATE_EVENT, null);
    }

    private filterValidCards(rightPanelForRoom?: IRightPanelForRoom): void {
        if (!rightPanelForRoom?.history) return;
        rightPanelForRoom.history = rightPanelForRoom.history.filter((card) => this.isCardStateValid(card));
        if (!rightPanelForRoom.history.length) {
            rightPanelForRoom.isOpen = false;
        }
    }

    private isCardStateValid(card: IRightPanelCard): boolean {
        // this function does a sanity check on the card. this is required because
        // some phases require specific state properties that might not be available.
        // This can be caused on if element is reloaded and the tries to reload right panel data from id's stored in the local storage.
        // we store id's of users and matrix events. If are not yet fetched on reload the right panel cannot display them.
        // or potentially other errors.
        // (A nicer fix could be to indicate, that the right panel is loading if there is missing state data and re-emit if the data is available)
        switch (card.phase) {
            case RightPanelPhases.ThreadView:
                if (!card.state?.threadHeadEvent) {
                    logger.warn("removed card from right panel because of missing threadHeadEvent in card state");
                }
                return !!card.state?.threadHeadEvent;
            case RightPanelPhases.RoomMemberInfo:
            case RightPanelPhases.SpaceMemberInfo:
            case RightPanelPhases.EncryptionPanel:
                if (!card.state?.member) {
                    logger.warn("removed card from right panel because of missing member in card state");
                }
                return !!card.state?.member;
            case RightPanelPhases.Room3pidMemberInfo:
            case RightPanelPhases.Space3pidMemberInfo:
                if (!card.state?.memberInfoEvent) {
                    logger.warn("removed card from right panel because of missing memberInfoEvent in card state");
                }
                return !!card.state?.memberInfoEvent;
            case RightPanelPhases.Widget:
                if (!card.state?.widgetId) {
                    logger.warn("removed card from right panel because of missing widgetId in card state");
                }
                return !!card.state?.widgetId;
        }
        return true;
    }

    private getVerificationRedirect(card: IRightPanelCard): IRightPanelCard | null {
        if (card.phase === RightPanelPhases.RoomMemberInfo && card.state) {
            // RightPanelPhases.RoomMemberInfo -> needs to be changed to RightPanelPhases.EncryptionPanel if there is a pending verification request
            const { member } = card.state;
            const pendingRequest = member
                ? pendingVerificationRequestForUser(MatrixClientPeg.get(), member)
                : undefined;
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

    private isPhaseValid(targetPhase: RightPanelPhases | null, isViewingRoom: boolean): boolean {
        if (!targetPhase || !RightPanelPhases[targetPhase]) {
            logger.warn(`Tried to switch right panel to unknown phase: ${targetPhase}`);
            return false;
        }
        if (!isViewingRoom) {
            logger.warn(
                `Tried to switch right panel to a room phase: ${targetPhase}, ` +
                    `but we are currently not viewing a room`,
            );
            return false;
        }
        return true;
    }

    private onVerificationRequestUpdate = (): void => {
        if (!this.currentCard?.state) return;
        const { member } = this.currentCard.state;
        if (!member) return;
        const pendingRequest = pendingVerificationRequestForUser(MatrixClientPeg.get(), member);
        if (pendingRequest) {
            this.currentCard.state.verificationRequest = pendingRequest;
            this.emitAndUpdateSettings();
        }
    };

    private handleViewedRoomChange(oldRoomId: Optional<string>, newRoomId: Optional<string>): void {
        if (!this.mxClient) return; // not ready, onReady will handle the first room
        this.viewedRoomId = newRoomId;
        // load values from byRoomCache with the viewedRoomId.
        this.loadCacheFromSettings();

        // when we're switching to a room, clear out any stale MemberInfo cards
        // in order to fix https://github.com/vector-im/element-web/issues/21487
        if (this.currentCard?.phase !== RightPanelPhases.EncryptionPanel) {
            const panel = this.byRoom[this.viewedRoomId];
            if (panel?.history) {
                panel.history = panel.history.filter(
                    (card) =>
                        card.phase != RightPanelPhases.RoomMemberInfo &&
                        card.phase != RightPanelPhases.Room3pidMemberInfo,
                );
            }
        }
        // when we're switching to a room, clear out thread permalinks to not get you stuck in the middle of the thread
        // in order to fix https://github.com/matrix-org/matrix-react-sdk/pull/11011
        if (this.currentCard?.phase === RightPanelPhases.ThreadView) {
            this.currentCard.state.initialEvent = undefined;
            this.currentCard.state.isInitialEventHighlighted = undefined;
            this.currentCard.state.initialEventScrollIntoView = undefined;
        }

        // If the right panel stays open mode is used, and the panel was either
        // closed or never shown for that room, then force it open and display
        // the room member list.
        if (SettingsStore.getValue("feature_right_panel_default_open") && !this.byRoom[this.viewedRoomId]?.isOpen) {
            const history = [{ phase: RightPanelPhases.RoomMemberList }];
            const room = this.viewedRoomId ? this.mxClient?.getRoom(this.viewedRoomId) : undefined;
            if (!room?.isSpaceRoom()) {
                history.unshift({ phase: RightPanelPhases.RoomSummary });
            }
            this.byRoom[this.viewedRoomId] = {
                isOpen: true,
                history,
            };
        }
        this.emitAndUpdateSettings();
    }

    public static get instance(): RightPanelStore {
        if (!this.internalInstance) {
            this.internalInstance = new RightPanelStore();
            this.internalInstance.start();
        }
        return this.internalInstance;
    }
}

window.mxRightPanelStore = RightPanelStore.instance;
