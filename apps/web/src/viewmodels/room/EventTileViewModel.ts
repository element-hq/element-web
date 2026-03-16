/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    CryptoEvent,
    EventShieldColour,
    type UserVerificationStatus,
    type EventShieldReason,
} from "matrix-js-sdk/src/crypto-api";
import {
    EventStatus,
    EventType,
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    type NotificationCountType,
    type Relations,
    type RelationType,
    type Room,
    RoomEvent,
    ThreadEvent,
    type Thread,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { BaseViewModel } from "@element-hq/web-shared-components";

import { TimelineRenderingType } from "../../contexts/RoomContext";
import { isMessageEvent } from "../../events/EventTileFactory";
import { objectHasDiff } from "../../utils/objects";

export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

export interface IReadReceiptProps {
    userId: string;
    ts: number;
}

export interface EventTileContextMenuState {
    position: Pick<DOMRect, "top" | "left" | "bottom">;
    link?: string;
}

export interface EventTileViewSnapshot {
    actionBarFocused: boolean;
    shieldColour: EventShieldColour;
    shieldReason: EventShieldReason | null;
    reactions: Relations | null;
    hover: boolean;
    focusWithin: boolean;
    contextMenu?: EventTileContextMenuState;
    isQuoteExpanded: boolean;
    thread: Thread | null;
    threadNotification?: NotificationCountType;
    shouldShowSentReceipt: boolean;
    shouldShowSendingReceipt: boolean;
    isHighlighted: boolean;
}

export interface EventTileViewModelProps {
    cli: MatrixClient;
    mxEvent: MatrixEvent;
    forExport?: boolean;
    showReactions?: boolean;
    getRelationsForEvent?: GetRelationsForEvent;
    readReceipts?: IReadReceiptProps[];
    lastSuccessful?: boolean;
    eventSendStatus?: EventStatus;
    timelineRenderingType: TimelineRenderingType;
    isRedacted?: boolean;
}

export class EventTileViewModel extends BaseViewModel<EventTileViewSnapshot, EventTileViewModelProps> {
    private isListeningForReceipts = false;

    public constructor(props: EventTileViewModelProps) {
        super(props, EventTileViewModel.computeSnapshot(props));

        if (!props.forExport) {
            this.disposables.trackListener(props.cli, CryptoEvent.UserTrustStatusChanged, (...args: unknown[]) =>
                this.onUserVerificationChanged(args[0] as string, args[1] as UserVerificationStatus),
            );
            this.disposables.trackListener(props.mxEvent, MatrixEventEvent.Decrypted, this.onDecrypted);
            this.disposables.trackListener(props.mxEvent, MatrixEventEvent.Replaced, this.onReplaced);

            if (props.showReactions) {
                this.disposables.trackListener(props.mxEvent, MatrixEventEvent.RelationsCreated, (...args: unknown[]) =>
                    this.onReactionsCreated(args[0] as string, args[1] as string),
                );
            }
        }

        this.disposables.trackListener(props.mxEvent, ThreadEvent.Update, (...args: unknown[]) =>
            this.updateThread(args[0] as Thread),
        );

        const roomId = props.mxEvent.getRoomId();
        const room = roomId ? props.cli.getRoom(roomId) : null;
        if (room) {
            this.disposables.trackListener(room, ThreadEvent.New, (...args: unknown[]) =>
                this.onNewThread(args[0] as Thread),
            );
        }

        this.updateReceiptListener();
        void this.verifyEvent();
    }

    public override dispose(): void {
        if (this.isListeningForReceipts) {
            this.props.cli.off(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = false;
        }
        super.dispose();
    }

    public setHover(hover: boolean): void {
        this.updateSnapshot({ hover });
    }

    public setFocusWithin(focusWithin: boolean): void {
        this.updateSnapshot({ focusWithin });
    }

    public setActionBarFocused(actionBarFocused: boolean): void {
        this.updateSnapshot({ actionBarFocused });
    }

    public setContextMenu(contextMenu?: EventTileContextMenuState): void {
        this.updateSnapshot({
            contextMenu,
            actionBarFocused: Boolean(contextMenu),
        });
    }

    public setQuoteExpanded(isQuoteExpanded: boolean): void {
        this.updateSnapshot({ isQuoteExpanded });
    }

    public refreshDerivedState(): void {
        this.updateSnapshot();
    }

    private updateSnapshot(partial?: Partial<EventTileViewSnapshot>): void {
        const nextSnapshot = {
            ...this.snapshot.current,
            ...partial,
        };

        nextSnapshot.shouldShowSentReceipt = this.getShouldShowSentReceipt();
        nextSnapshot.shouldShowSendingReceipt = this.getShouldShowSendingReceipt();
        nextSnapshot.isHighlighted = this.getShouldHighlight();

        if (objectHasDiff(this.snapshot.current, nextSnapshot)) {
            this.snapshot.set(nextSnapshot);
        }

        this.updateReceiptListener();
    }

    private updateReceiptListener(): void {
        const shouldListen = this.getShouldShowSentReceipt() || this.getShouldShowSendingReceipt();
        if (shouldListen && !this.isListeningForReceipts) {
            this.props.cli.on(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = true;
        } else if (!shouldListen && this.isListeningForReceipts) {
            this.props.cli.off(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = false;
        }
    }

    private static computeSnapshot(props: EventTileViewModelProps): EventTileViewSnapshot {
        return {
            actionBarFocused: false,
            shieldColour: EventShieldColour.NONE,
            shieldReason: null,
            reactions: EventTileViewModel.getReactions(props),
            hover: false,
            focusWithin: false,
            contextMenu: undefined,
            isQuoteExpanded: false,
            thread: EventTileViewModel.getThread(props),
            threadNotification: undefined,
            shouldShowSentReceipt: EventTileViewModel.getShouldShowSentReceipt(props),
            shouldShowSendingReceipt: EventTileViewModel.getShouldShowSendingReceipt(props),
            isHighlighted: EventTileViewModel.getShouldHighlight(props),
        };
    }

    private static isEligibleForSpecialReceipt(props: EventTileViewModelProps): boolean {
        if (props.readReceipts && props.readReceipts.length > 0) return false;

        const roomId = props.mxEvent.getRoomId();
        const room = roomId ? props.cli.getRoom(roomId) : null;
        if (!room) return false;

        const myUserId = props.cli.getUserId();
        if (!myUserId || props.mxEvent.getSender() !== myUserId) return false;

        if (!isMessageEvent(props.mxEvent) && props.mxEvent.getType() !== EventType.RoomMessageEncrypted) return false;

        return true;
    }

    private getShouldShowSentReceipt(): boolean {
        return EventTileViewModel.getShouldShowSentReceipt(this.props);
    }

    private static getShouldShowSentReceipt(props: EventTileViewModelProps): boolean {
        if (!this.isEligibleForSpecialReceipt(props)) return false;
        if (!props.lastSuccessful) return false;
        if (props.timelineRenderingType === TimelineRenderingType.ThreadsList) return false;
        if (props.eventSendStatus && props.eventSendStatus !== EventStatus.SENT) return false;

        const receipts = props.readReceipts || [];
        const myUserId = props.cli.getUserId();
        if (receipts.some((receipt) => receipt.userId !== myUserId)) return false;

        return true;
    }

    private getShouldShowSendingReceipt(): boolean {
        return EventTileViewModel.getShouldShowSendingReceipt(this.props);
    }

    private static getShouldShowSendingReceipt(props: EventTileViewModelProps): boolean {
        if (!this.isEligibleForSpecialReceipt(props)) return false;
        if (!props.eventSendStatus || props.eventSendStatus === EventStatus.SENT) return false;
        return true;
    }

    private static getThread(props: EventTileViewModelProps): Thread | null {
        let thread = props.mxEvent.getThread() ?? undefined;
        if (!thread) {
            const roomId = props.mxEvent.getRoomId();
            const room = roomId ? props.cli.getRoom(roomId) : null;
            thread = room?.findThreadForEvent(props.mxEvent) ?? undefined;
        }
        return thread ?? null;
    }

    private getReactions(): Relations | null {
        return EventTileViewModel.getReactions(this.props);
    }

    private static getReactions(props: EventTileViewModelProps): Relations | null {
        if (!props.showReactions || !props.getRelationsForEvent) {
            return null;
        }

        const eventId = props.mxEvent.getId();
        if (!eventId) {
            return null;
        }

        return props.getRelationsForEvent(eventId, "m.annotation", "m.reaction") ?? null;
    }

    private getShouldHighlight(): boolean {
        return EventTileViewModel.getShouldHighlight(this.props);
    }

    private static getShouldHighlight(props: EventTileViewModelProps): boolean {
        if (props.forExport) return false;
        if (props.timelineRenderingType === TimelineRenderingType.Notification) return false;
        if (props.timelineRenderingType === TimelineRenderingType.ThreadsList) return false;
        if (props.isRedacted) return false;

        const actions = props.cli.getPushActionsForEvent(props.mxEvent.replacingEvent() || props.mxEvent);
        const previousActions = props.mxEvent.replacingEvent()
            ? props.cli.getPushActionsForEvent(props.mxEvent)
            : undefined;

        if (!actions?.tweaks && !previousActions?.tweaks) {
            return false;
        }

        if (props.mxEvent.getSender() === props.cli.credentials.userId) {
            return false;
        }

        return !!(actions?.tweaks.highlight || previousActions?.tweaks.highlight);
    }

    private onRoomReceipt = (_event: MatrixEvent, room: Room): void => {
        const roomId = this.props.mxEvent.getRoomId();
        const tileRoom = roomId ? this.props.cli.getRoom(roomId) : null;
        if (room !== tileRoom) return;

        this.updateSnapshot();
    };

    private onDecrypted = (): void => {
        void this.verifyEvent();
        this.updateSnapshot();
    };

    private onUserVerificationChanged = (userId: string, _trustStatus: UserVerificationStatus): void => {
        if (userId === this.props.mxEvent.getSender()) {
            void this.verifyEvent();
        }
    };

    private onReplaced = (): void => {
        void this.verifyEvent();
        this.updateSnapshot();
    };

    private onReactionsCreated = (relationType: string, eventType: string): void => {
        if (relationType !== "m.annotation" || eventType !== "m.reaction") {
            return;
        }

        this.updateSnapshot({
            reactions: this.getReactions(),
        });
    };

    private updateThread = (thread: Thread): void => {
        this.updateSnapshot({ thread });
    };

    private onNewThread = (thread: Thread): void => {
        if (thread.id === this.props.mxEvent.getId()) {
            this.updateThread(thread);
        }
    };

    private async verifyEvent(): Promise<void> {
        try {
            const event = this.props.mxEvent.replacingEvent() ?? this.props.mxEvent;

            if (!event.isEncrypted() || event.isRedacted()) {
                this.updateSnapshot({
                    shieldColour: EventShieldColour.NONE,
                    shieldReason: null,
                });
                return;
            }

            const encryptionInfo = (await this.props.cli.getCrypto()?.getEncryptionInfoForEvent(event)) ?? null;
            if (encryptionInfo === null) {
                this.updateSnapshot({
                    shieldColour: EventShieldColour.NONE,
                    shieldReason: null,
                });
                return;
            }

            this.updateSnapshot({
                shieldColour: encryptionInfo.shieldColour,
                shieldReason: encryptionInfo.shieldReason,
            });
        } catch (error) {
            logger.error(
                `Error getting encryption info on event ${this.props.mxEvent.getId()} in room ${this.props.mxEvent.getRoomId()}`,
                error,
            );
        }
    }
}
