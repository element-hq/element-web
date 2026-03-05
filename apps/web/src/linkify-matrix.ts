/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { type linkifyjs, LinkifyMatrixOpaqueIdType } from "@element-hq/web-shared-components";
import { getHttpUriForMxc, User } from "matrix-js-sdk/src/matrix";

import {
    parsePermalink,
    tryTransformEntityToPermalink,
    tryTransformPermalinkToLocalHref,
} from "./utils/permalinks/Permalinks";
import dis from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";
import { type ViewUserPayload } from "./dispatcher/payloads/ViewUserPayload";
import { type ViewRoomPayload } from "./dispatcher/payloads/ViewRoomPayload";
import { MatrixClientPeg } from "./MatrixClientPeg";

function onUserClick(event: MouseEvent, userId: string): void {
    event.preventDefault();
    dis.dispatch<ViewUserPayload>({
        action: Action.ViewUser,
        member: new User(userId),
    });
}

function onAliasClick(event: MouseEvent, roomAlias: string): void {
    event.preventDefault();
    dis.dispatch<ViewRoomPayload>({
        action: Action.ViewRoom,
        room_alias: roomAlias,
        metricsTrigger: "Timeline",
        metricsViaKeyboard: false,
    });
}

const escapeRegExp = function (s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Recognise URLs from both our local and official Element deployments.
// Anyone else really should be using matrix.to. vector:// allowed to support Element Desktop relative links.
export const ELEMENT_URL_PATTERN =
    "^(?:vector://|https?://)?(?:" +
    escapeRegExp(window.location.host + window.location.pathname) +
    "|" +
    "(?:www\\.)?(?:riot|vector)\\.im/(?:app|beta|staging|develop)/|" +
    "(?:app|beta|staging|develop)\\.element\\.io/" +
    ")(#.*)";

// Attach click handlers to links based on their type
function events(href: string, type: string): linkifyjs.EventListeners {
    switch (type as LinkifyMatrixOpaqueIdType) {
        case LinkifyMatrixOpaqueIdType.URL: {
            // intercept local permalinks to users and show them like userids (in userinfo of current room)
            try {
                const permalink = parsePermalink(href);
                if (permalink?.userId) {
                    return {
                        click: function (e: MouseEvent) {
                            onUserClick(e, permalink.userId!);
                        },
                    };
                } else {
                    // for events, rooms etc. (anything other than users)
                    const localHref = tryTransformPermalinkToLocalHref(href);
                    if (localHref !== href) {
                        // it could be converted to a localHref -> therefore handle locally
                        return {
                            click: function (e: MouseEvent) {
                                e.preventDefault();
                                window.location.hash = localHref;
                            },
                        };
                    }
                }
            } catch {
                // OK fine, it's not actually a permalink
            }
            break;
        }
        case LinkifyMatrixOpaqueIdType.UserId:
            return {
                click: function (e: MouseEvent) {
                    e.preventDefault();
                    const userId = parsePermalink(href)?.userId ?? href;
                    if (userId) onUserClick(e, userId);
                },
            };
        case LinkifyMatrixOpaqueIdType.RoomAlias:
            return {
                click: function (e: MouseEvent) {
                    e.preventDefault();
                    const alias = parsePermalink(href)?.roomIdOrAlias ?? href;
                    if (alias) onAliasClick(e, alias);
                },
            };
    }

    return {};
}

// linkify-react doesn't respect `events` and needs it mapping to React attributes
// so we need to manually add the click handler to the attributes
// https://linkify.js.org/docs/linkify-react.html#events
function attributes(href: string, type: string): Record<string, unknown> {
    const attrs: Record<string, unknown> = {
        rel: "noreferrer noopener",
    };

    const options = events(href, type);
    if (options?.click) {
        attrs.onClick = options.click;
    }

    return attrs;
}

export const options: linkifyjs.Opts = {
    events,

    formatHref: function (href: string, type: LinkifyMatrixOpaqueIdType | string): string {
        switch (type) {
            case LinkifyMatrixOpaqueIdType.URL:
                if (href.startsWith("mxc://") && MatrixClientPeg.get()) {
                    return getHttpUriForMxc(
                        MatrixClientPeg.get()!.baseUrl,
                        href,
                        undefined,
                        undefined,
                        undefined,
                        false,
                        true,
                    );
                }
            // fallthrough
            case LinkifyMatrixOpaqueIdType.RoomAlias:
            case LinkifyMatrixOpaqueIdType.UserId:
            default: {
                return tryTransformEntityToPermalink(MatrixClientPeg.safeGet(), href) ?? "";
            }
        }
    },

    attributes,

    ignoreTags: ["a", "pre", "code"],

    className: "linkified",

    target: function (href: string, type: LinkifyMatrixOpaqueIdType | string): string {
        if (type === LinkifyMatrixOpaqueIdType.URL) {
            try {
                const transformed = tryTransformPermalinkToLocalHref(href);
                if (
                    transformed !== href || // if it could be converted to handle locally for matrix symbols e.g. @user:server.tdl and matrix.to
                    decodeURIComponent(href).match(ELEMENT_URL_PATTERN) // for https links to Element domains
                ) {
                    return "";
                } else {
                    return "_blank";
                }
            } catch {
                // malformed URI
            }
        }
        return "";
    },
};
