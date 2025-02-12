/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as linkifyjs from "linkifyjs";
import { type EventListeners, type Opts, registerCustomProtocol, registerPlugin } from "linkifyjs";
import linkifyElement from "linkify-element";
import linkifyString from "linkify-string";
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
import { PERMITTED_URL_SCHEMES } from "./utils/UrlUtils";

export enum Type {
    URL = "url",
    UserId = "userid",
    RoomAlias = "roomalias",
}

function matrixOpaqueIdLinkifyParser({
    scanner,
    parser,
    token,
    name,
}: {
    scanner: linkifyjs.ScannerInit;
    parser: linkifyjs.ParserInit;
    token: "#" | "+" | "@";
    name: Type;
}): void {
    const {
        DOT,
        // IPV4 necessity
        NUM,
        COLON,
        SYM,
        SLASH,
        EQUALS,
        HYPHEN,
        UNDERSCORE,
    } = scanner.tokens;

    // Contains NUM, WORD, UWORD, EMOJI, TLD, UTLD, SCHEME, SLASH_SCHEME and LOCALHOST plus custom protocols (e.g. "matrix")
    const { domain } = scanner.tokens.groups;

    // Tokens we need that are not contained in the domain group
    const additionalLocalpartTokens = [DOT, SYM, SLASH, EQUALS, UNDERSCORE, HYPHEN];
    const additionalDomainpartTokens = [HYPHEN];

    const matrixToken = linkifyjs.createTokenClass(name, { isLink: true });
    const matrixTokenState = new linkifyjs.State(matrixToken) as any as linkifyjs.State<linkifyjs.MultiToken>; // linkify doesn't appear to type this correctly

    const matrixTokenWithPort = linkifyjs.createTokenClass(name, { isLink: true });
    const matrixTokenWithPortState = new linkifyjs.State(
        matrixTokenWithPort,
    ) as any as linkifyjs.State<linkifyjs.MultiToken>; // linkify doesn't appear to type this correctly

    const INITIAL_STATE = parser.start.tt(token);

    // Localpart
    const LOCALPART_STATE = new linkifyjs.State<linkifyjs.MultiToken>();
    INITIAL_STATE.ta(domain, LOCALPART_STATE);
    INITIAL_STATE.ta(additionalLocalpartTokens, LOCALPART_STATE);
    LOCALPART_STATE.ta(domain, LOCALPART_STATE);
    LOCALPART_STATE.ta(additionalLocalpartTokens, LOCALPART_STATE);

    // Domainpart
    const DOMAINPART_STATE_DOT = LOCALPART_STATE.tt(COLON);
    DOMAINPART_STATE_DOT.ta(domain, matrixTokenState);
    DOMAINPART_STATE_DOT.ta(additionalDomainpartTokens, matrixTokenState);
    matrixTokenState.ta(domain, matrixTokenState);
    matrixTokenState.ta(additionalDomainpartTokens, matrixTokenState);
    matrixTokenState.tt(DOT, DOMAINPART_STATE_DOT);

    // Port suffixes
    matrixTokenState.tt(COLON).tt(NUM, matrixTokenWithPortState);
}

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

export const options: Opts = {
    events: function (href: string, type: string): EventListeners {
        switch (type as Type) {
            case Type.URL: {
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
            case Type.UserId:
                return {
                    click: function (e: MouseEvent) {
                        const userId = parsePermalink(href)?.userId ?? href;
                        if (userId) onUserClick(e, userId);
                    },
                };
            case Type.RoomAlias:
                return {
                    click: function (e: MouseEvent) {
                        const alias = parsePermalink(href)?.roomIdOrAlias ?? href;
                        if (alias) onAliasClick(e, alias);
                    },
                };
        }

        return {};
    },

    formatHref: function (href: string, type: Type | string): string {
        switch (type) {
            case "url":
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
            case Type.RoomAlias:
            case Type.UserId:
            default: {
                return tryTransformEntityToPermalink(MatrixClientPeg.safeGet(), href) ?? "";
            }
        }
    },

    attributes: {
        rel: "noreferrer noopener",
    },

    ignoreTags: ["pre", "code"],

    className: "linkified",

    target: function (href: string, type: Type | string): string {
        if (type === Type.URL) {
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

// Run the plugins
registerPlugin(Type.RoomAlias, ({ scanner, parser }) => {
    const token = scanner.tokens.POUND as "#";
    matrixOpaqueIdLinkifyParser({
        scanner,
        parser,
        token,
        name: Type.RoomAlias,
    });
});

registerPlugin(Type.UserId, ({ scanner, parser }) => {
    const token = scanner.tokens.AT as "@";
    matrixOpaqueIdLinkifyParser({
        scanner,
        parser,
        token,
        name: Type.UserId,
    });
});

// Linkify supports some common protocols but not others, register all permitted url schemes if unsupported
// https://github.com/Hypercontext/linkifyjs/blob/f4fad9df1870259622992bbfba38bfe3d0515609/packages/linkifyjs/src/scanner.js#L133-L141
// This also handles registering the `matrix:` protocol scheme
const linkifySupportedProtocols = ["file", "mailto", "http", "https", "ftp", "ftps"];
const optionalSlashProtocols = [
    "bitcoin",
    "geo",
    "im",
    "magnet",
    "mailto",
    "matrix",
    "news",
    "openpgp4fpr",
    "sip",
    "sms",
    "smsto",
    "tel",
    "urn",
    "xmpp",
];

PERMITTED_URL_SCHEMES.forEach((scheme) => {
    if (!linkifySupportedProtocols.includes(scheme)) {
        registerCustomProtocol(scheme, optionalSlashProtocols.includes(scheme));
    }
});

registerCustomProtocol("mxc", false);

export const linkify = linkifyjs;
export const _linkifyElement = linkifyElement;
export const _linkifyString = linkifyString;
