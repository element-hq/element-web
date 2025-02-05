/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RoomMember, type User, type Room, type ResizeMethod } from "matrix-js-sdk/src/matrix";
import { useIdColorHash } from "@vector-im/compound-web";

import DMRoomMap from "./utils/DMRoomMap";
import { mediaFromMxc } from "./customisations/Media";
import { isLocalRoom } from "./utils/localRoom/isLocalRoom";
import { getFirstGrapheme } from "./utils/strings";

/**
 * Hardcoded from the Compound colors.
 * Shade for background as defined in the compound web implementation
 * https://github.com/vector-im/compound-web/blob/main/src/components/Avatar
 */
const AVATAR_BG_COLORS = ["#e9f2ff", "#faeefb", "#e3f7ed", "#ffecf0", "#ffefe4", "#e3f5f8", "#f1efff", "#e0f8d9"];
const AVATAR_TEXT_COLORS = ["#043894", "#671481", "#004933", "#7e0642", "#850000", "#004077", "#4c05b5", "#004b00"];

// Not to be used for BaseAvatar urls as that has similar default avatar fallback already
export function avatarUrlForMember(
    member: RoomMember | undefined,
    width: number,
    height: number,
    resizeMethod: ResizeMethod,
): string {
    let url: string | null | undefined;
    if (member?.getMxcAvatarUrl()) {
        url = mediaFromMxc(member.getMxcAvatarUrl()).getThumbnailOfSourceHttp(width, height, resizeMethod);
    }
    if (!url) {
        // member can be null here currently since on invites, the JS SDK
        // does not have enough info to build a RoomMember object for
        // the inviter.
        url = defaultAvatarUrlForString(member ? member.userId : "");
    }
    return url;
}

/**
 * Determines the HEX color to use in the avatar pills
 * @param id the user or room ID
 * @returns the text color to use on the avatar
 */
export function getAvatarTextColor(id: string): string {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const index = useIdColorHash(id);

    return AVATAR_TEXT_COLORS[index - 1];
}

export function avatarUrlForUser(
    user: Pick<User, "avatarUrl">,
    width: number,
    height: number,
    resizeMethod?: ResizeMethod,
): string | null {
    if (!user.avatarUrl) return null;
    return mediaFromMxc(user.avatarUrl).getThumbnailOfSourceHttp(width, height, resizeMethod);
}

function isValidHexColor(color: string): boolean {
    return (
        typeof color === "string" &&
        (color.length === 7 || color.length === 9) &&
        color.startsWith("#") &&
        !color
            .slice(1)
            .split("")
            .some((c) => isNaN(parseInt(c, 16)))
    );
}

function urlForColor(color: string): string {
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    // bail out when using jsdom in unit tests
    if (!ctx) {
        return "";
    }
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    return canvas.toDataURL();
}

// XXX: Ideally we'd clear this cache when the theme changes
// but since this function is at global scope, it's a bit
// hard to install a listener here, even if there were a clear event to listen to
const colorToDataURLCache = new Map<string, string>();

export function defaultAvatarUrlForString(s: string): string {
    if (!s) return ""; // XXX: should never happen but empirically does by evidence of a rageshake
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const colorIndex = useIdColorHash(s);
    // overwritten color value in custom themes
    const cssVariable = `--avatar-background-colors_${colorIndex}`;
    const cssValue = getComputedStyle(document.body).getPropertyValue(cssVariable);
    const color = cssValue || AVATAR_BG_COLORS[colorIndex - 1];
    let dataUrl = colorToDataURLCache.get(color);
    if (!dataUrl) {
        // validate color as this can come from account_data
        // with custom theming
        if (isValidHexColor(color)) {
            dataUrl = urlForColor(color);
            colorToDataURLCache.set(color, dataUrl);
        } else {
            dataUrl = "";
        }
    }
    return dataUrl;
}

/**
 * returns the first (non-sigil) character of 'name',
 * converted to uppercase
 * @param {string} name
 * @return {string} the first letter
 */
export function getInitialLetter(name: string): string | undefined {
    if (!name) {
        // XXX: We should find out what causes the name to sometimes be falsy.
        console.trace("`name` argument to `getInitialLetter` not supplied");
        return undefined;
    }
    if (name.length < 1) {
        return undefined;
    }

    const initial = name[0];
    if ((initial === "@" || initial === "#" || initial === "+") && name[1]) {
        name = name.substring(1);
    }

    return getFirstGrapheme(name).toUpperCase();
}

export function avatarUrlForRoom(
    room: Room | null,
    width?: number,
    height?: number,
    resizeMethod?: ResizeMethod,
): string | null {
    if (!room) return null; // null-guard

    if (room.getMxcAvatarUrl()) {
        const media = mediaFromMxc(room.getMxcAvatarUrl() ?? undefined);
        if (width !== undefined && height !== undefined) {
            return media.getThumbnailOfSourceHttp(width, height, resizeMethod);
        }
        return media.srcHttp;
    }

    // space rooms cannot be DMs so skip the rest
    if (room.isSpaceRoom()) return null;

    // If the room is not a DM don't fallback to a member avatar
    if (!DMRoomMap.shared().getUserIdForRoomId(room.roomId) && !isLocalRoom(room)) {
        return null;
    }

    // If there are only two members in the DM use the avatar of the other member
    const otherMember = room.getAvatarFallbackMember();
    if (otherMember?.getMxcAvatarUrl()) {
        const media = mediaFromMxc(otherMember.getMxcAvatarUrl());
        if (width !== undefined && height !== undefined) {
            return media.getThumbnailOfSourceHttp(width, height, resizeMethod);
        }
        return media.srcHttp;
    }
    return null;
}
