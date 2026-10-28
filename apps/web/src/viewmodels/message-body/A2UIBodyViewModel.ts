/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    type Relations,
    RelationsEvent,
    RelationType,
    type TimelineEvents,
} from "matrix-js-sdk/src/matrix";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import {
    A2UISurfaceSet,
    type A2UIJsonValue,
    type A2UISurfaceViewModel as A2UISurfaceViewModelInterface,
    type A2UISurfaceViewSnapshot,
    BaseViewModel,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import { mediaFromMxc } from "../../customisations/Media";
import Modal from "../../Modal";
import ImageView from "../../components/views/elements/ImageView";
import {
    A2UI_ACTION_EVENT_TYPE,
    A2UI_UPDATE_EVENT_TYPE,
    getA2UIMessages,
    isA2UIUpdateFor,
    makeA2UIActionContent,
} from "../../a2ui/A2UIEvents";
import { type GetRelationsForEvent } from "../room/timeline/event-tile/reactions/EventTileReactionState";

const logger = rootLogger.getChild("A2UIBodyViewModel");

export interface A2UIBodyViewModelProps {
    /** The `io.element.a2ui` message that defines the surfaces. */
    mxEvent: MatrixEvent;
    cli: MatrixClient;
    /** Looks up the update events related to the message. */
    getRelationsForEvent?: GetRelationsForEvent;
    /** Whether images and videos may be shown, per the media preview rules for this event. */
    mediaVisible: boolean;
    /** Stores a per-event media visibility override, as the timeline does for images. */
    setMediaVisible: (visible: boolean) => void;
}

/**
 * View model for an A2UI message in the timeline.
 *
 * It builds the surfaces from the message's own A2UI messages, applies `io.element.a2ui.update` events as they
 * arrive, records the user's input and sends `io.element.a2ui.action` events when a button is pressed.
 */
export class A2UIBodyViewModel
    extends BaseViewModel<A2UISurfaceViewSnapshot, A2UIBodyViewModelProps>
    implements A2UISurfaceViewModelInterface
{
    private surfaces = new A2UISurfaceSet({ resolveMediaUrl: this.resolveMediaUrl.bind(this) });
    /** Update events already applied, so a relation refresh does not replay them. */
    private appliedUpdates = new Set<string>();
    private relations?: Relations;

    public constructor(props: A2UIBodyViewModelProps) {
        super(props, { surfaces: [], sending: false, mediaVisible: props.mediaVisible });
        // Watch first so the initial build includes updates that already arrived.
        this.watchRelations();
        this.rebuild();
        this.disposables.trackListener(props.mxEvent, MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
        this.disposables.trackListener(props.mxEvent, MatrixEventEvent.Decrypted, this.rebuild);
        // An m.replace edit swaps the event's content for the new surfaces; getContent() already returns it.
        this.disposables.trackListener(props.mxEvent, MatrixEventEvent.Replaced, this.rebuild);
        this.disposables.track(() => this.unwatchRelations());
    }

    /** Swap in a new event object for the same message, as React may do on re-render. */
    public setEvent(mxEvent: MatrixEvent): void {
        if (mxEvent === this.props.mxEvent) return;
        this.props = { ...this.props, mxEvent };
        this.rebuild();
    }

    /** Update the media visibility inputs, which React recomputes from settings and room state. */
    public setMediaProps(mediaVisible: boolean, setMediaVisible: (visible: boolean) => void): void {
        this.props = { ...this.props, mediaVisible, setMediaVisible };
        this.snapshot.merge({ mediaVisible });
    }

    public showMedia = (): void => {
        this.props.setMediaVisible(true);
    };

    public openImage = (url: string, description?: string): void => {
        // The A2UI message is not a media event, so the viewer gets the URL alone rather than the event.
        Modal.createDialog(
            ImageView,
            { src: url, name: description || _t("common|attachment") },
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    };

    public setInputValue = (surfaceId: string, key: string, path: string | undefined, value: A2UIJsonValue): void => {
        this.surfaces.get(surfaceId)?.setInputValue(key, path, value);
        this.refresh();
    };

    public triggerAction = (surfaceId: string, key: string): void => {
        const surface = this.surfaces.get(surfaceId);
        const action = surface?.resolveAction(key);
        if (!surface || !action) return;

        const content = makeA2UIActionContent(
            this.props.mxEvent.getId()!,
            {
                name: action.name,
                surfaceId,
                sourceComponentId: action.sourceComponentId,
                timestamp: new Date().toISOString(),
                context: action.context,
            },
            surface.sendDataModel ? surface.getDataModel() : undefined,
        );

        this.snapshot.merge({ sending: true, error: undefined });
        // The action event type is not part of the SDK's known timeline events.
        this.props.cli
            .sendEvent(
                this.props.mxEvent.getRoomId()!,
                A2UI_ACTION_EVENT_TYPE as keyof TimelineEvents,
                content as unknown as TimelineEvents[keyof TimelineEvents],
            )
            .then(
                () => this.snapshot.merge({ sending: false }),
                (error) => {
                    logger.error("Failed to send A2UI action", error);
                    this.snapshot.merge({ sending: false, error: _t("a2ui|send_failed") });
                },
            );
    };

    /** Apply the message's own A2UI messages and any updates seen so far, from scratch. */
    private rebuild = (): void => {
        this.surfaces = new A2UISurfaceSet({ resolveMediaUrl: this.resolveMediaUrl.bind(this) });
        this.appliedUpdates.clear();
        for (const message of getA2UIMessages(this.props.mxEvent.getContent())) {
            this.surfaces.apply(message);
        }
        this.applyUpdates(this.relations?.getRelations() ?? []);
        this.refresh();
    };

    private applyUpdates(updates: MatrixEvent[]): void {
        const pending = updates
            .filter((update) => !this.appliedUpdates.has(update.getId()!))
            .filter((update) => isA2UIUpdateFor(update, this.props.mxEvent))
            .sort((a, b) => a.getTs() - b.getTs());
        for (const update of pending) {
            this.appliedUpdates.add(update.getId()!);
            for (const message of getA2UIMessages(update.getContent())) {
                this.surfaces.apply(message);
            }
        }
    }

    private refresh(): void {
        this.snapshot.merge({ surfaces: this.surfaces.all().map((surface) => surface.resolve()) });
    }

    private resolveMediaUrl(url: string): string | undefined {
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("mxc://")) return mediaFromMxc(url, this.props.cli).srcHttp ?? undefined;
        return undefined;
    }

    private watchRelations(): void {
        const eventId = this.props.mxEvent.getId();
        if (!eventId || !this.props.getRelationsForEvent) return;
        const relations = this.props.getRelationsForEvent(eventId, RelationType.Reference, A2UI_UPDATE_EVENT_TYPE);
        if (!relations || relations === this.relations) return;

        this.unwatchRelations();
        this.relations = relations;
        relations.on(RelationsEvent.Add, this.onUpdateAdded);
        relations.on(RelationsEvent.Remove, this.rebuild);
        relations.on(RelationsEvent.Redaction, this.rebuild);
    }

    private unwatchRelations(): void {
        this.relations?.off(RelationsEvent.Add, this.onUpdateAdded);
        this.relations?.off(RelationsEvent.Remove, this.rebuild);
        this.relations?.off(RelationsEvent.Redaction, this.rebuild);
        this.relations = undefined;
    }

    private onRelationsCreated = (relationType: unknown, eventType: unknown): void => {
        if (relationType !== RelationType.Reference || eventType !== A2UI_UPDATE_EVENT_TYPE) return;
        this.watchRelations();
        this.rebuild();
    };

    private onUpdateAdded = (update: MatrixEvent): void => {
        // Apply just the new update so edits the user has already made are kept.
        this.applyUpdates([update]);
        this.refresh();
    };
}
