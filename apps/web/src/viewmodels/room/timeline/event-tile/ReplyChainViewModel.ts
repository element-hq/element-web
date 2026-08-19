/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
// note: useIdColorHash is not used as a React hook here
import { useIdColorHash as idColorHash } from "@vector-im/compound-web";
import {
    BaseViewModel,
    type ReplyChainColor,
    type ReplyChainViewModel as ReplyChainViewModelInterface,
    type ReplyChainViewSnapshot,
} from "@element-hq/web-shared-components";

import dis from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { getParentEventId, shouldDisplayReply } from "../../../../utils/Reply";

export interface ReplyChainViewModelProps {
    /** Matrix client used to resolve reply events. */
    cli: MatrixClient;
    /** Event whose reply chain is rendered. */
    parentEv: MatrixEvent;
    /** Whether the tile is being rendered for export. */
    forExport?: boolean;
    /** Current quote expansion state controlled by EventTile. */
    isQuoteExpanded?: boolean;
    /** Updates the quote expansion state owned by EventTile. */
    setQuoteExpanded: (isExpanded: boolean) => void;
}

/**
 * Application-side ReplyChain behavior and event-loading model.
 *
 * Matrix SDK objects stay here; ReplyChainView consumes only the primitive
 * snapshot and host-owned render slots.
 */
export class ReplyChainViewModel
    extends BaseViewModel<ReplyChainViewSnapshot, ReplyChainViewModelProps>
    implements ReplyChainViewModelInterface
{
    private room: Room | null | undefined;
    private events: MatrixEvent[] = [];
    private loadedEv: MatrixEvent | null = null;
    private loading = true;
    private error = false;
    private requestId = 0;

    public constructor(props: ReplyChainViewModelProps) {
        super(props, {
            status: props.forExport ? "export" : "loading",
            events: [],
            parentEventId: getParentEventId(props.parentEv),
            isQuoteExpanded: props.isQuoteExpanded,
        });

        this.room = props.cli.getRoom(props.parentEv.getRoomId());
        void this.initialize();
    }

    public setProps(props: ReplyChainViewModelProps): void {
        const eventChanged = this.props.parentEv !== props.parentEv || this.props.cli !== props.cli;
        const exportChanged = this.props.forExport !== props.forExport;

        this.props = props;
        this.room = props.cli.getRoom(props.parentEv.getRoomId());
        this.snapshot.merge({
            isQuoteExpanded: props.isQuoteExpanded,
            parentEventId: getParentEventId(props.parentEv),
        });

        if (eventChanged) {
            void this.initialize();
        } else if (exportChanged) {
            this.updateSnapshot();
        }
    }

    public getEventById(eventId: string): MatrixEvent | undefined {
        if (this.loadedEv?.getId() === eventId) return this.loadedEv;
        return this.events.find((event) => event.getId() === eventId);
    }

    public canCollapse = (): boolean => this.events.length > 1;

    public collapse = (): void => {
        void this.initialize();
    };

    public setQuoteExpanded = (isExpanded: boolean): void => {
        this.props.setQuoteExpanded(isExpanded);
        this.snapshot.merge({ isQuoteExpanded: isExpanded });
    };

    public onQuoteClick = async (): Promise<void> => {
        if (!this.loadedEv) return;

        const currentRequestId = this.requestId;
        const events = [this.loadedEv, ...this.events];
        this.events = events;
        this.loadedEv = null;
        this.updateSnapshot();

        const nextEvent = await this.getNextEvent(events[0]);
        if (this.isStale(currentRequestId)) return;

        this.loadedEv = nextEvent;
        this.updateSnapshot();
        dis.fire(Action.FocusSendMessageComposer);
    };

    private async initialize(): Promise<void> {
        const currentRequestId = ++this.requestId;
        this.events = [];
        this.loadedEv = null;
        this.loading = true;
        this.error = false;
        this.updateSnapshot();

        const event = await this.getEvent(getParentEventId(this.props.parentEv));
        if (this.isStale(currentRequestId)) return;

        if (!event) {
            this.loading = false;
            this.error = true;
            this.updateSnapshot();
            return;
        }

        const loadedEv = await this.getNextEvent(event);
        if (this.isStale(currentRequestId)) return;

        this.events = [event];
        this.loadedEv = loadedEv;
        this.loading = false;
        this.updateSnapshot();
    }

    private async getNextEvent(event: MatrixEvent): Promise<MatrixEvent | null> {
        try {
            const inReplyToEventId = getParentEventId(event);
            if (!inReplyToEventId) return null;
            return await this.getEvent(inReplyToEventId);
        } catch {
            return null;
        }
    }

    private async getEvent(eventId?: string): Promise<MatrixEvent | null> {
        if (!eventId || !this.room) return null;

        const event = this.room.findEventById(eventId);
        if (event) return event;

        try {
            await this.props.cli.getEventTimeline(this.room.getUnfilteredTimelineSet(), eventId);
        } catch {
            return null;
        }

        return this.room.findEventById(eventId) ?? null;
    }

    private isStale(requestId: number): boolean {
        return this.isDisposed || requestId !== this.requestId;
    }

    private updateSnapshot(): void {
        const firstEvent = this.events[0];
        const headerEventId =
            firstEvent && this.loadedEv && shouldDisplayReply(firstEvent)
                ? (this.loadedEv.getId() ?? undefined)
                : undefined;

        let status: ReplyChainViewSnapshot["status"] = "ready";
        if (this.error) {
            status = "error";
        } else if (!headerEventId && this.props.forExport) {
            status = "export";
        } else if (this.loading) {
            status = "loading";
        }

        this.snapshot.set({
            status,
            events: this.events.map((event) => ({
                id: event.getId()!,
                color: this.getColor(event.getSender()),
            })),
            headerEventId,
            parentEventId: getParentEventId(this.props.parentEv),
            isQuoteExpanded: this.props.isQuoteExpanded,
        });
    }

    private getColor(senderId: string | null | undefined): ReplyChainColor {
        const color = idColorHash(senderId ?? "") as ReplyChainColor;
        return color >= 1 && color <= 6 ? color : 1;
    }
}
