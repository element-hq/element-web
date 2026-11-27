/*
Copyright 2026 Johannes Camp jcamp@gmx.de

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EventTimeline, EventType, type MatrixClient, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { type ImageContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type LightboxNavigationViewActions,
    type LightboxNavigationViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import { MediaEventHelper } from "../../utils/MediaEventHelper";
import { isMimeTypeAllowed } from "../../utils/blobs";
import { shouldImageFallbackToFileBody } from "../../utils/media/imageEvents";

/**
 * How many pages of older history to fetch, at most, per "Previous" when looking for an older image.
 * The user can press "Previous" again to look further back.
 */
const MAX_PAGES_PER_STEP = 5;
const PAGE_SIZE = 50;

export interface LightboxNavigationViewModelProps {
    /**
     * Client used to load and paginate the timeline.
     */
    client: MatrixClient;
    /**
     * The `m.image` event the lightbox was opened on.
     */
    initialEvent: MatrixEvent;
    /**
     * URL the lightbox was opened with for the initial image. Shown until the image's own URL has
     * been resolved, and used if it cannot be.
     */
    initialSrc: string;
}

export interface LightboxNavigationViewModelSnapshot extends LightboxNavigationViewSnapshot {
    /**
     * The image event currently shown.
     */
    currentEvent: MatrixEvent;
    /**
     * URL of the image currently shown.
     */
    src: string;
    /**
     * Name of the image currently shown.
     */
    name: string;
}

function isImageEvent(ev: MatrixEvent): boolean {
    if (ev.isRedacted()) return false;
    if (ev.getType() !== EventType.RoomMessage) return false;

    const content = ev.getContent<ImageContent>();
    if (content?.msgtype !== MsgType.Image) return false;

    // Some events claim to be images but are rendered as files for security; those cannot be
    // navigated to as images. Shared with the image body so the two cannot drift apart.
    return !shouldImageFallbackToFileBody(content, Boolean(content.file));
}

function eventToName(ev: MatrixEvent): string {
    const content = ev.getContent<ImageContent>();
    return content?.body && content.body.length > 0 ? content.body : _t("common|attachment");
}

/**
 * Previous/next navigation for the image lightbox: which image is shown, and stepping to the
 * previous (older) and next (newer) image of the same timeline, paginating further back in the
 * history when needed.
 *
 * The collection navigated is the images of the timeline the event was opened from: the room's
 * main timeline, or, for a reply inside a thread, that thread. Only `m.image` events are included
 * (an image thread root opened from the main timeline navigates the room's images). Videos, files
 * and other media are not part of the collection as they never open in the lightbox.
 */
export class LightboxNavigationViewModel
    extends BaseViewModel<LightboxNavigationViewModelSnapshot, LightboxNavigationViewModelProps>
    implements LightboxNavigationViewActions
{
    /** The timeline holding the initial event, once loaded. */
    private timeline: EventTimeline | null = null;
    /** The known image events of the timeline, oldest first. */
    private images: MatrixEvent[] = [];
    /** Whether the timeline may hold older history that has not been fetched yet. */
    private canPaginateBackwards = true;
    /** Helper resolving the URL of the current image. Destroying it revokes the URLs it created. */
    private mediaHelper: MediaEventHelper | null = null;

    public constructor(props: LightboxNavigationViewModelProps) {
        super(props, {
            currentEvent: props.initialEvent,
            src: props.initialSrc,
            name: eventToName(props.initialEvent),
            // Unknown until the timeline has loaded
            canGoToPrevious: false,
            canGoToNext: false,
            isNavigating: false,
        });

        this.disposables.track(() => {
            this.mediaHelper?.destroy();
            this.mediaHelper = null;
        });

        void this.resolveSrc(props.initialEvent);
        void this.loadTimeline();
    }

    public goToPrevious = async (): Promise<void> => {
        const { canGoToPrevious, isNavigating } = this.snapshot.current;
        if (!canGoToPrevious || isNavigating) return;

        const index = this.currentIndex();
        if (index > 0) {
            this.showImage(this.images[index - 1]);
            return;
        }
        if (!this.timeline) return;

        // Look for an older image in the history not fetched yet
        this.snapshot.merge({ isNavigating: true });
        try {
            await this.showOlderImageFromHistory(this.timeline);
        } catch (e) {
            logger.error("Failed to load older history for the image lightbox", e);
        } finally {
            if (!this.isDisposed) this.snapshot.merge({ isNavigating: false, ...this.navigationState() });
        }
    };

    public goToNext = (): void => {
        if (this.snapshot.current.isNavigating) return;
        const index = this.currentIndex();
        if (index < 0 || index >= this.images.length - 1) return;
        this.showImage(this.images[index + 1]);
    };

    /**
     * Load the timeline holding the initial event, to find the images around it.
     */
    private async loadTimeline(): Promise<void> {
        const { client, initialEvent } = this.props;
        const roomId = initialEvent.getRoomId();
        const room = roomId ? client.getRoom(roomId) : null;
        const eventId = initialEvent.getId();

        // A reply inside a thread lives in the thread's timeline, not the room's, so navigate
        // the thread's images. A thread root is part of the main timeline and navigates the room.
        const thread = initialEvent.getThread();
        const timelineSet =
            thread && !initialEvent.isThreadRoot ? thread.timelineSet : room?.getUnfilteredTimelineSet();

        let timeline: EventTimeline | null = null;
        if (timelineSet && eventId) {
            try {
                // Get a timeline that actually contains the event
                timeline = await client.getEventTimeline(timelineSet, eventId);
            } catch {
                // Fall back to the live timeline if the event's timeline cannot be obtained
                timeline = timelineSet.getLiveTimeline();
            }
            if (this.isDisposed) return;
        }

        this.timeline = timeline;
        this.images = timeline?.getEvents().filter(isImageEvent) ?? [];
        this.snapshot.merge(this.navigationState());
    }

    /**
     * Fetch older history, a page at a time, until an image older than the current one turns up and
     * show it, the start of the history is reached, or {@link MAX_PAGES_PER_STEP} pages were fetched.
     */
    private async showOlderImageFromHistory(timeline: EventTimeline): Promise<void> {
        const currentId = this.snapshot.current.currentEvent.getId();

        for (let page = 0; page < MAX_PAGES_PER_STEP && this.canPaginateBackwards; page++) {
            const hasMore = await this.props.client.paginateEventTimeline(timeline, {
                backwards: true,
                limit: PAGE_SIZE,
            });
            if (this.isDisposed) return;
            this.canPaginateBackwards = hasMore === true;

            const images = timeline.getEvents().filter(isImageEvent);
            const index = images.findIndex((ev) => ev.getId() === currentId);
            // The current image fell out of the timeline: keep the known images and look further back
            if (index === -1) continue;

            this.images = images;
            if (index > 0) {
                this.showImage(images[index - 1]);
                return;
            }
        }
        // No older image was found yet; unless the start of the history was reached, another
        // "Previous" looks further back
    }

    private currentIndex(currentEvent = this.snapshot.current.currentEvent): number {
        return this.images.findIndex((ev) => ev.getId() === currentEvent.getId());
    }

    private showImage(event: MatrixEvent): void {
        this.snapshot.merge({ currentEvent: event, name: eventToName(event), ...this.navigationState(event) });
        void this.resolveSrc(event);
    }

    /**
     * Which navigation buttons to offer for the given image.
     */
    private navigationState(
        currentEvent = this.snapshot.current.currentEvent,
    ): Pick<LightboxNavigationViewSnapshot, "canGoToPrevious" | "canGoToNext"> {
        const index = this.currentIndex(currentEvent);
        return {
            // An older image is known, or the history not fetched yet may hold one
            canGoToPrevious: index > 0 || (this.timeline !== null && this.canPaginateBackwards),
            canGoToNext: index >= 0 && index < this.images.length - 1,
        };
    }

    /**
     * Resolve the URL to show for the given image, replacing the one of the previous image.
     */
    private async resolveSrc(event: MatrixEvent): Promise<void> {
        this.mediaHelper?.destroy();
        const helper = new MediaEventHelper(event);
        this.mediaHelper = helper;

        let src: string | null = null;
        try {
            const content = event.getContent<ImageContent>();
            const isEncrypted = Boolean(content.file);
            // Encrypted images of a type we do not render inline are shown through their
            // thumbnail, as in the timeline.
            const [preferred, fallback] =
                isEncrypted && !isMimeTypeAllowed(content.info?.mimetype ?? "")
                    ? [helper.thumbnailUrl, helper.sourceUrl]
                    : [helper.sourceUrl, helper.thumbnailUrl];
            src = (await preferred.value) ?? (await fallback.value);
        } catch {
            // Fall back to the initial URL below
        }

        // Ignore the result if another image was shown meanwhile, or the lightbox was closed
        if (this.mediaHelper !== helper) return;
        this.snapshot.merge({ src: src ?? this.props.initialSrc });
    }
}
