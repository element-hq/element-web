/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { type Optional } from "matrix-events-sdk";

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
    type IRightPanelCard,
    type IRightPanelCardState,
    type IRightPanelForRoom,
} from "./RightPanelStoreIPanelState";
import { type ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";
import { type ActiveRoomChangedPayload } from "../../dispatcher/payloads/ActiveRoomChangedPayload";
import { SdkContextClass } from "../../contexts/SDKContext";
import { MatrixClientPeg } from "../../MatrixClientPeg";

/**
 * @see RightPanelStore#generateHistoryForPhase
 */
function getPhasesForPhase(phase: IRightPanelCard["phase"]): RightPanelPhases[] {
    switch (phase) {
        case RightPanelPhases.ThreadPanel:
        case RightPanelPhases.MemberList:
        case RightPanelPhases.PinnedMessages:
            return [RightPanelPhases.RoomSummary];
        case RightPanelPhases.MemberInfo:
        case RightPanelPhases.ThreePidMemberInfo:
            return [RightPanelPhases.RoomSummary, RightPanelPhases.MemberList];
        default:
            return [];
    }
}

/**
 * A class for tracking the state of the right panel between layouts and
 * sessions. This state includes a history for each room. Each history element
 * contains the phase (e.g. RightPanelPhase.RoomMemberInfo) and the state (e.g.
 * the member) associated with it.
 */
export default class RightPanelStore extends ReadyWatchingStore {
    private static internalInstance: RightPanelStore;

    private global?: IRightPanelForRoom;
    private byRoom: { [roomId: string]: IRightPanelForRoom } = {};
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
        this.matrixClient?.on(CryptoEvent.VerificationRequestReceived, this.onVerificationRequestUpdate);
        this.loadCacheFromSettings();
        this.emitAndUpdateSettings();
    }

    protected async onNotReady(): Promise<any> {
        this.matrixClient?.off(CryptoEvent.VerificationRequestReceived, this.onVerificationRequestUpdate);
    }

    protected onDispatcherAction(payload: ActionPayload): void {
        switch (payload.action) {
            case Action.ActiveRoomChanged: {
                const changePayload = <ActiveRoomChangedPayload>payload;
                this.handleViewedRoomChange(changePayload.oldRoomId, changePayload.newRoomId);
                break;
            }

            case Action.FocusMessageSearch: {
                if (this.currentCard.phase !== RightPanelPhases.RoomSummary) {
                    this.setCard({ phase: RightPanelPhases.RoomSummary, state: { focusRoomSearch: true } });
                }
                this.show(null);
            }
        }
    }

    // Getters
    /**
     * If you are calling this from a component that already knows about a
     * specific room from props / state, then it's best to prefer
     * `isOpenForRoom` below to ensure all your data is for a single room
     * during room changes.
     */
    public get isOpen(): boolean {
        return this.byRoom[this.viewedRoomId ?? ""]?.isOpen ?? false;
    }

    public isOpenForRoom(roomId: string): boolean {
        return this.byRoom[roomId]?.isOpen ?? false;
    }

    public get roomPhaseHistory(): Array<IRightPanelCard> {
        return this.byRoom[this.viewedRoomId ?? ""]?.history ?? [];
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

    /**
     * This function behaves as following:
     * - If the same phase is sent along with a non-empty state, only the state is updated and history is retained.
     * - If the provided phase is different to the current phase:
     *     - Existing history is thrown away.
     *     - New card is added along with a different history, see {@link generateHistoryForPhase}
     *
     * If the right panel was set, this function also shows the right panel.
     */
    public setCard(card: IRightPanelCard, allowClose = true, roomId?: string): void {
        const rId = roomId ?? this.viewedRoomId ?? "";
        const redirect = this.getVerificationRedirect(card);
        const targetPhase = redirect?.phase ?? card.phase;
        const cardState = redirect?.state ?? (Object.keys(card.state ?? {}).length === 0 ? undefined : card.state);

        // Checks for wrong SetRightPanelPhase requests
        if (!this.isPhaseValid(targetPhase, Boolean(rId))) return;

        if (targetPhase === this.currentCardForRoom(rId)?.phase && !!cardState) {
            // Update state: set right panel with a new state but keep the phase (don't know it this is ever needed...)
            const hist = this.byRoom[rId]?.history ?? [];
            hist[hist.length - 1].state = cardState;
            this.emitAndUpdateSettings();
        } else if (targetPhase !== this.currentCardForRoom(rId)?.phase || !this.byRoom[rId]) {
            // Set right panel and initialize/erase history
            const history = this.generateHistoryForPhase(targetPhase!, cardState ?? {});
            this.byRoom[rId] = { history, isOpen: true };
            this.emitAndUpdateSettings();
        } else {
            this.show(rId);
            this.emitAndUpdateSettings();
        }
    }

    public setCards(cards: IRightPanelCard[], allowClose = true, roomId: string | null = null): void {
        // This function sets the history of the right panel and shows the right panel if not already visible.
        const rId = roomId ?? this.viewedRoomId ?? "";
        const history = cards.map((c) => ({ phase: c.phase, state: c.state ?? {} }));
        this.byRoom[rId] = { history, isOpen: true };
        this.show(rId);
        this.emitAndUpdateSettings();
    }

    // Appends a card to the history and shows the right panel if not already visible
    public pushCard(card: IRightPanelCard, allowClose = true, roomId: string | null = null): void {
        const rId = roomId ?? this.viewedRoomId ?? "";
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
        const rId = roomId ?? this.viewedRoomId ?? "";
        if (!this.byRoom[rId]) return;

        const removedCard = this.byRoom[rId].history.pop();
        this.emitAndUpdateSettings();
        return removedCard;
    }

    public togglePanel(roomId: string | null): void {
        const rId = roomId ?? this.viewedRoomId ?? "";
        if (!this.byRoom[rId]) return;

        this.byRoom[rId].isOpen = !this.byRoom[rId].isOpen;
        this.emitAndUpdateSettings();
    }

    public show(roomId: string | null): void {
        if (!this.isOpenForRoom(roomId ?? this.viewedRoomId ?? "")) {
            this.togglePanel(roomId);
        }
    }

    public hide(roomId: string | null): void {
        if (this.isOpenForRoom(roomId ?? this.viewedRoomId ?? "")) {
            this.togglePanel(roomId);
        }
    }

    /**
     * Helper to show a right panel phase.
     * If the UI is already showing that phase, the right panel will be hidden.
     *
     * Calling the same phase twice with a different state will update the current
     * phase and push the old state in the right panel history.
     * @param phase The right panel phase.
     * @param cardState The state within the phase.
     */
    public showOrHidePhase(phase: RightPanelPhases, cardState?: Partial<IRightPanelCardState>): void {
        if (this.currentCard.phase === phase && !cardState && this.isOpen) {
            this.togglePanel(null);
        } else {
            this.setCard({ phase, state: cardState });
            if (!this.isOpen) this.togglePanel(null);
        }
    }

    /**
     * For a given phase, generates card history such that it looks
     * similar to how an user typically would reach said phase in the app.
     * eg: User would usually reach the memberlist via room-info panel, so
     * that history is added.
     */
    private generateHistoryForPhase(
        phase: IRightPanelCard["phase"],
        cardState?: Partial<IRightPanelCardState>,
    ): IRightPanelCard[] {
        const card = { phase, state: cardState };
        if (!this.isCardStateValid(card)) {
            /**
             * If the card we're adding is not valid, then we just return
             * an empty history.
             * This is to avoid a scenario where, for eg, you set a member info
             * card with invalid card state (no member) but the member list is
             * shown since the created history is valid except for the last card.
             */
            return [];
        }
        const cards = getPhasesForPhase(phase).map((p) => ({ phase: p, state: {} }));
        return [...cards, card];
    }

    private loadCacheFromSettings(): void {
        if (this.viewedRoomId) {
            const room = this.mxClient?.getRoom(this.viewedRoomId);
            if (!!room) {
                this.global =
                    this.global ??
                    convertToStatePanel(SettingsStore.getValue("RightPanel.phasesGlobal"), room) ??
                    undefined;
                this.byRoom[this.viewedRoomId] =
                    this.byRoom[this.viewedRoomId] ??
                    convertToStatePanel(SettingsStore.getValue("RightPanel.phases", this.viewedRoomId), room) ??
                    undefined;
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
            case RightPanelPhases.MemberInfo:
            case RightPanelPhases.EncryptionPanel:
                if (!card.state?.member) {
                    logger.warn("removed card from right panel because of missing member in card state");
                }
                return !!card.state?.member;
            case RightPanelPhases.ThreePidMemberInfo:
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
        if (card.phase === RightPanelPhases.MemberInfo && card.state) {
            // RightPanelPhases.RoomMemberInfo -> needs to be changed to RightPanelPhases.EncryptionPanel if there is a pending verification request
            const { member } = card.state;
            const pendingRequest = member
                ? pendingVerificationRequestForUser(MatrixClientPeg.safeGet(), member)
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
        const pendingRequest = pendingVerificationRequestForUser(MatrixClientPeg.safeGet(), member);
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
            const panel = this.byRoom[this.viewedRoomId ?? ""];
            if (panel?.history) {
                panel.history = panel.history.filter(
                    (card: IRightPanelCard) =>
                        card.phase != RightPanelPhases.MemberInfo && card.phase != RightPanelPhases.ThreePidMemberInfo,
                );
            }
        }
        // when we're switching to a room, clear out thread permalinks to not get you stuck in the middle of the thread
        // in order to fix https://github.com/matrix-org/matrix-react-sdk/pull/11011
        if (this.currentCard?.phase === RightPanelPhases.ThreadView && this.currentCard.state) {
            this.currentCard.state.initialEvent = undefined;
            this.currentCard.state.isInitialEventHighlighted = undefined;
            this.currentCard.state.initialEventScrollIntoView = undefined;
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
