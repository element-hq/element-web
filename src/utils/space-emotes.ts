import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SpaceStore from "../stores/spaces/SpaceStore";

export const EMOTE_EVENT_TYPE = "im.ponies.room_emotes";

export type CustomEmoteMap = Map<string, { url: string }>;

/**
 * Collects custom emotes from all parent spaces of a room.
 * @param client - the Matrix client
 * @param roomId - the room to get emotes for
 * @returns a map of shortcode to emote info
 */
export function getCustomEmotesForRoom(client: MatrixClient, roomId: string | undefined): CustomEmoteMap {
    const emotes: CustomEmoteMap = new Map();
    if (!roomId) return emotes;

    const parentSpaceIds = SpaceStore.instance.getKnownParents(roomId);
    for (const spaceId of parentSpaceIds) {
        const spaceRoom = client.getRoom(spaceId);
        if (!spaceRoom) continue;

        const event = spaceRoom.currentState.getStateEvents(EMOTE_EVENT_TYPE, "");
        const images = event?.getContent()?.images;
        if (images && typeof images === "object") {
            for (const [shortcode, info] of Object.entries(images)) {
                if (info && typeof info === "object" && "url" in info && typeof (info as any).url === "string") {
                    emotes.set(shortcode, { url: (info as any).url });
                }
            }
        }
    }

    // Also get the emotes for the room itself, so you can use emotes from FluffyChat, etc.
    const roomRoom = client.getRoom(roomId);
    const event = roomRoom.currentState.getStateEvents(EMOTE_EVENT_TYPE, "");
    const images = event?.getContent()?.images;
    if (images && typeof images === "object") {
        for (const [shortcode, info] of Object.entries(images)) {
            if (info && typeof info === "object" && "url" in info && typeof (info as any).url === "string") {
                emotes.set(shortcode, { url: (info as any).url });
            }
        }
    }

    return emotes;
}

const CUSTOM_EMOTE_REGEX = /:([a-zA-Z0-9_-]+):/g;

/**
 * Replaces custom emote shortcodes in message content with HTML img tags.
 * Modifies the content in-place, setting format and formatted_body when
 * custom emotes are found.
 */
export function applyCustomEmotesToContent(content: Record<string, any>, emotes: CustomEmoteMap): void {
    if (emotes.size === 0) return;

    const body: string | undefined = content.body;
    if (!body) return;

    const replaceEmotes = (text: string): string =>
        text.replace(CUSTOM_EMOTE_REGEX, (match: string, shortcode: string) => {
            const emote = emotes.get(shortcode);
            if (!emote) return match;
            return `<img data-mx-emoticon="" src="${emote.url}" alt=":${shortcode}:" title=":${shortcode}:" height="32" vertical-align="middle" />`;
        });

    const formattedBody = replaceEmotes(body);

    // Only modify content if at least one shortcode was replaced
    if (formattedBody !== body) {
        content.format = "org.matrix.custom.html";
        if (content.formatted_body) {
            content.formatted_body = replaceEmotes(content.formatted_body);
        } else {
            content.formatted_body = formattedBody;
        }
    }
}

