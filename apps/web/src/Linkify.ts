/*
Copyright 2026 Element Creations Ltd.
Copyright 2024, 2025 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import sanitizeHtml, { type IOptions } from "sanitize-html";
import {
    PERMITTED_URL_SCHEMES,
    linkifyString as _linkifyString,
    linkifyHtml as _linkifyHtml,
    LinkifyMatrixOpaqueIdType,
    generateLinkedTextOptions,
    type LinkEventListener,
} from "@element-hq/web-shared-components";
import { getHttpUriForMxc, User } from "matrix-js-sdk/src/matrix";

import { ELEMENT_URL_PATTERN } from "./linkify-matrix";
import { mediaFromMxc } from "./customisations/Media";
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

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const MEDIA_API_MXC_REGEX = /\/_matrix\/media\/r0\/(?:download|thumbnail)\/(.+?)\/(.+?)(?:[?/]|$)/;

export const transformTags: NonNullable<IOptions["transformTags"]> = {
    // custom to matrix
    // add blank targets to all hyperlinks except vector URLs
    "a": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        if (attribs.href) {
            attribs.target = "_blank"; // by default

            const transformed = tryTransformPermalinkToLocalHref(attribs.href); // only used to check if it is a link that can be handled locally
            if (
                transformed !== attribs.href || // it could be converted so handle locally symbols e.g. @user:server.tdl, matrix: and matrix.to
                ELEMENT_URL_PATTERN.test(attribs.href) // for https links to Element domains
            ) {
                delete attribs.target;
            }
        } else {
            // Delete the href attrib if it is falsy
            delete attribs.href;
        }

        attribs.rel = "noreferrer noopener"; // https://mathiasbynens.github.io/rel-noopener/
        return { tagName, attribs };
    },
    "img": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        let src = attribs.src;
        // Strip out imgs that aren't `mxc` here instead of using allowedSchemesByTag
        // because transformTags is used _before_ we filter by allowedSchemesByTag and
        // we don't want to allow images with `https?` `src`s.
        if (!src) {
            return { tagName, attribs: {} };
        }

        if (!src.startsWith("mxc://")) {
            const match = MEDIA_API_MXC_REGEX.exec(src);
            if (match) {
                src = `mxc://${match[1]}/${match[2]}`;
            }
        }

        if (!src.startsWith("mxc://")) {
            return { tagName, attribs: {} };
        }

        const requestedWidth = Number(attribs.width);
        const requestedHeight = Number(attribs.height);
        const width = Math.min(requestedWidth || 800, 800);
        const height = Math.min(requestedHeight || 600, 600);
        // specify width/height as max values instead of absolute ones to allow object-fit to do its thing
        // we only allow our own styles for this tag so overwrite the attribute
        attribs.style = `max-width: ${width}px; max-height: ${height}px;`;
        if (requestedWidth) {
            attribs.style += "width: 100%;";
        }
        if (requestedHeight) {
            attribs.style += "height: 100%;";
        }
        attribs.src = mediaFromMxc(src).getThumbnailOfSourceHttp(width, height)!;
        return { tagName, attribs };
    },
    "code": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        if (typeof attribs.class !== "undefined") {
            // Filter out all classes other than ones starting with language- for syntax highlighting.
            const classes = attribs.class.split(/\s/).filter(function (cl) {
                return cl.startsWith("language-") && !cl.startsWith("language-_");
            });
            attribs.class = classes.join(" ");
        }
        return { tagName, attribs };
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "*": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        // Delete any style previously assigned, style is an allowedTag for font, span & img,
        // because attributes are stripped after transforming.
        // For img this is trusted as it is generated wholly within the img transformation method.
        if (tagName !== "img") {
            delete attribs.style;
        }

        // Sanitise and transform data-mx-color and data-mx-bg-color to their CSS
        // equivalents
        const customCSSMapper: Record<string, string> = {
            "data-mx-color": "color",
            "data-mx-bg-color": "background-color",
            // $customAttributeKey: $cssAttributeKey
        };

        let style = "";
        Object.keys(customCSSMapper).forEach((customAttributeKey) => {
            const cssAttributeKey = customCSSMapper[customAttributeKey];
            const customAttributeValue = attribs[customAttributeKey];
            if (
                customAttributeValue &&
                typeof customAttributeValue === "string" &&
                COLOR_REGEX.test(customAttributeValue)
            ) {
                style += cssAttributeKey + ":" + customAttributeValue + ";";
                delete attribs[customAttributeKey];
            }
        });

        if (style) {
            attribs.style = style + (attribs.style || "");
        }

        return { tagName, attribs };
    },
};

export const sanitizeHtmlParams: IOptions = {
    allowedTags: [
        // These tags are suggested by the spec https://spec.matrix.org/v1.10/client-server-api/#mroommessage-msgtypes
        "font", // custom to matrix for IRC-style font coloring
        "del", // for markdown
        "s",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "p",
        "a",
        "ul",
        "ol",
        "sup",
        "sub",
        "nl",
        "li",
        "b",
        "i",
        "u",
        "strong",
        "em",
        "strike",
        "code",
        "hr",
        "br",
        "div",
        "table",
        "thead",
        "caption",
        "tbody",
        "tr",
        "th",
        "td",
        "pre",
        "span",
        "img",
        "details",
        "summary",
    ],
    allowedAttributes: {
        // attribute sanitization happens after transformations, so we have to accept `style` for font, span & img
        // but strip during the transformation.
        // custom ones first:
        font: ["color", "data-mx-bg-color", "data-mx-color", "style"], // custom to matrix
        span: ["data-mx-maths", "data-mx-bg-color", "data-mx-color", "data-mx-spoiler", "style"], // custom to matrix
        div: ["data-mx-maths"],
        a: ["href", "name", "target", "rel"], // remote target: custom to matrix
        // img tags also accept width/height, we just map those to max-width & max-height during transformation
        img: ["src", "alt", "title", "style"],
        ol: ["start"],
        code: ["class"], // We don't actually allow all classes, we filter them in transformTags
    },
    // Lots of these won't come up by default because we don't allow them
    selfClosing: ["img", "br", "hr", "area", "base", "basefont", "input", "link", "meta"],
    // URL schemes we permit
    allowedSchemes: PERMITTED_URL_SCHEMES,
    allowProtocolRelative: false,
    transformTags,
    // 50 levels deep "should be enough for anyone"
    nestingLimit: 50,
};

/**
 * Handler function when a UserID link is clicked.
 * @param event The click event
 * @param userId The linked UserID
 */
function onUserClick(event: MouseEvent, userId: string): void {
    event.preventDefault();
    dis.dispatch<ViewUserPayload>({
        action: Action.ViewUser,
        member: new User(userId),
    });
}

/**
 * Handler function when a Room Alias link is clicked.
 * @param event The click event
 * @param roomAlias The linked room alias
 */
function onAliasClick(event: MouseEvent, roomAlias: string): void {
    event.preventDefault();
    dis.dispatch<ViewRoomPayload>({
        action: Action.ViewRoom,
        room_alias: roomAlias,
        metricsTrigger: "Timeline",
        metricsViaKeyboard: false,
    });
}

/**
 * Generates a set of event handlers for a regular URL link.
 *
 * @param href The link location.
 * @returns Event listenenrs compatible with linkifyjs.
 */
function urlEventListeners(href: string): LinkEventListener {
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
                        globalThis.location.hash = localHref;
                    },
                };
            }
        }
    } catch {
        // OK fine, it's not actually a permalink
    }
    return {};
}

/**
 * Generates a set of event handlers for a UserID link.
 *
 * @param href A link that contains a userId.
 * @returns Event listenenrs compatible with linkifyjs.
 */
export function userIdEventListeners(href: string): LinkEventListener {
    return {
        click: function (e: MouseEvent) {
            e.preventDefault();
            const userId = parsePermalink(href)?.userId ?? href;
            if (userId) onUserClick(e, userId);
        },
    };
}

/**
 * Generates a set of event handlers for a UserID link.
 *
 * @param href A link that contains a room alias.
 * @returns Event listenenrs compatible with linkifyjs.
 */
export function roomAliasEventListeners(href: string): LinkEventListener {
    return {
        click: function (e: MouseEvent) {
            e.preventDefault();
            const alias = parsePermalink(href)?.roomIdOrAlias ?? href;
            if (alias) onAliasClick(e, alias);
        },
    };
}

/**
 * Generates a `target` attribute for the anchor element
 * for the given `href` value.
 *
 * @param href A URL from a link.
 * @returns The resulting `target` value.
 */
function urlTargetTransformFunction(href: string): string {
    try {
        const transformed = tryTransformPermalinkToLocalHref(href);
        if (
            transformed !== href || // if it could be converted to handle locally for matrix symbols e.g. @user:server.tdl and matrix.to
            ELEMENT_URL_PATTERN.test(decodeURIComponent(href)) // for https links to Element domains
        ) {
            return "";
        } else {
            return "_blank";
        }
    } catch {
        // malformed URI
    }
    return "";
}

/**
 * Generates the result `href` value based on an incoming `href` value and a link type.
 *
 * @param href A URL from a link.
 * @param type The type of link beinh handled.
 * @returns The resulting `href` value.
 */
export function formatHref(href: string, type: LinkifyMatrixOpaqueIdType): string {
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
}

/**
 * The standard configuration for a LinkedTextContext.Provider
 * within Element Web.
 */
export const LinkedTextConfiguration = {
    userIdListener: userIdEventListeners,
    roomAliasListener: roomAliasEventListeners,
    urlListener: urlEventListeners,
    hrefTransformer: formatHref,
    urlTargetTransformer: urlTargetTransformFunction,
};

/**
 * Linkifies the given string. This is a wrapper around 'linkifyjs/string'.
 *
 * @param str string to linkify
 * @param [options] Options for linkifyString.
 * @returns Linkified string
 */
export function linkifyString(value: string, options = generateLinkedTextOptions(LinkedTextConfiguration)): string {
    return _linkifyString(value, options);
}

/**
 * Linkifies the given HTML-formatted string. This is a wrapper around 'linkifyjs/html'.
 *
 * @param str HTML string to linkify
 * @param [options] Options for linkifyHtml.
 * @returns Linkified string
 */
export function linkifyHtml(value: string, options = generateLinkedTextOptions(LinkedTextConfiguration)): string {
    return _linkifyHtml(value, options);
}

/**
 * Linkify the given string and sanitize the HTML afterwards.
 *
 * @param dirtyString The string to linkify, and then sanitize.
 * @param [options] Options for linkifyString. Default: linkifyMatrixOptions
 * @returns HTML string
 */
export function linkifyAndSanitizeHtml(
    dirtyHtml: string,
    options = generateLinkedTextOptions(LinkedTextConfiguration),
): string {
    return sanitizeHtml(linkifyString(dirtyHtml, options), sanitizeHtmlParams);
}
