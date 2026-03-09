/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import * as linkifyjs from "linkifyjs";

/**
 * This file describes common linkify configuration settings such as supported protocols.
 * The instance of "linkifyjs" is the canonical instance that all dependant apps should use.
 *
 * Plugins should be configured inside this file exclusively so as to avoid contamination of
 * the global state.
 */

/**
 * List of supported protocols natively by linkify. Kept in sync with upstreanm.
 * @see https://github.com/nfrasser/linkifyjs/blob/main/packages/linkifyjs/src/scanner.mjs#L171-L177
 */
export const LinkifySupportedProtocols = ["file", "mailto", "http", "https", "ftp", "ftps"];

/**
 * Protocols that do not require a slash in the URL.
 */
export const LinkifyOptionalSlashProtocols = [
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

/**
 * URL schemes that are safe to be resolved by the app consuming the library.
 */
export const PERMITTED_URL_SCHEMES = [...LinkifySupportedProtocols, ...LinkifyOptionalSlashProtocols];

// Linkify supports some common protocols but not others, register all permitted url schemes if unsupported
// https://github.com/nfrasser/linkifyjs/blob/main/packages/linkifyjs/src/scanner.mjs#L171-L177
// This also handles registering the `matrix:` protocol scheme
PERMITTED_URL_SCHEMES.forEach((scheme) => {
    if (!LinkifySupportedProtocols.includes(scheme)) {
        linkifyjs.registerCustomProtocol(scheme, LinkifyOptionalSlashProtocols.includes(scheme));
    }
});

// 'mxc' is specialcased. They can be linked to
linkifyjs.registerCustomProtocol("mxc", false);

export enum LinkifyMatrixOpaqueIdType {
    URL = "url",
    UserId = "userid",
    RoomAlias = "roomalias",
}

/**
 * Finds instances of room aliases and user IDs.
 */
function matrixOpaqueIdLinkifyParser({
    scanner,
    parser,
    token,
    name,
}: {
    scanner: linkifyjs.ScannerInit;
    parser: linkifyjs.ParserInit;
    token: "#" | "@";
    name: LinkifyMatrixOpaqueIdType;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matrixTokenState = new linkifyjs.State(matrixToken) as any as linkifyjs.State<linkifyjs.MultiToken>; // linkify doesn't appear to type this correctly

    const matrixTokenWithPort = linkifyjs.createTokenClass(name, { isLink: true });
    const matrixTokenWithPortState = new linkifyjs.State(
        matrixTokenWithPort,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Register plugins
linkifyjs.registerPlugin(LinkifyMatrixOpaqueIdType.RoomAlias, ({ scanner, parser }) => {
    const token = scanner.tokens.POUND as "#";
    matrixOpaqueIdLinkifyParser({
        scanner,
        parser,
        token,
        name: LinkifyMatrixOpaqueIdType.RoomAlias,
    });
});

linkifyjs.registerPlugin(LinkifyMatrixOpaqueIdType.UserId, ({ scanner, parser }) => {
    const token = scanner.tokens.AT as "@";
    matrixOpaqueIdLinkifyParser({
        scanner,
        parser,
        token,
        name: LinkifyMatrixOpaqueIdType.UserId,
    });
});

export type LinkEventListener = linkifyjs.EventListeners;

export interface LinkedTextOptions {
    /**
     * Event handlers for URL links.
     */
    urlListener?: (href: string) => LinkEventListener;
    /**
     * Event handlers for room alias links.
     */
    roomAliasListener?: (href: string) => LinkEventListener;
    /**
     * Event handlers for user ID links.
     */
    userIdListener?: (href: string) => LinkEventListener;
    /**
     * Function that can be used to transform the `target` attribute on links, depending on the `href`.
     */
    urlTargetTransformer?: (href: string) => string;
    /**
     * Function that can be used to transform the `href` attribute on links, depending on the current href and target type.
     */
    hrefTransformer?: (href: string, target: LinkifyMatrixOpaqueIdType) => string;
    /**
     * Function called before all listeners when a link is clicked.
     */
    onLinkClick?: (ev: MouseEvent) => void;
}

/**
 * Generates a linkifyjs options object that is reasonably paired down
 * to just the essentials required for an Element client.
 *
 * @return A `linkifyjs` `Opts` object. Used by `linkifyString` and `linkifyHtml`
 * @see `linkifyHtml`
 * @see `linkifyString`
 */
export function generateLinkedTextOptions({
    urlListener,
    roomAliasListener,
    userIdListener,
    urlTargetTransformer,
    hrefTransformer,
    onLinkClick,
}: LinkedTextOptions): linkifyjs.Opts {
    const events = (href: string, type: string): LinkEventListener => {
        switch (type as LinkifyMatrixOpaqueIdType) {
            case LinkifyMatrixOpaqueIdType.URL: {
                if (urlListener) {
                    return urlListener(href);
                }
                break;
            }
            case LinkifyMatrixOpaqueIdType.UserId:
                if (userIdListener) {
                    return userIdListener(href);
                }
                break;
            case LinkifyMatrixOpaqueIdType.RoomAlias:
                if (roomAliasListener) {
                    return roomAliasListener(href);
                }
                break;
        }

        return {};
    };

    const attributes = (href: string, type: string): Record<string, unknown> => {
        const attrs: Record<string, unknown> = {
            [`data-${LINKIFIED_DATA_ATTRIBUTE}`]: "true",
        };
        // linkify-react doesn't respect `events` and needs it mapping to React attributes
        // so we need to manually add the click handler to the attributes
        // https://linkify.js.org/docs/linkify-react.html#events
        const options = events(href, type);
        if (options?.click) {
            attrs.onClick = options.click;
        }
        if (onLinkClick) {
            attrs.onClick = (ev: MouseEvent) => {
                onLinkClick(ev);
                options?.click?.(ev);
            };
        }

        return attrs;
    };

    return {
        rel: "noreferrer noopener",
        ignoreTags: ["a", "pre", "code"],
        defaultProtocol: "https",
        events,
        attributes,
        target(href, type) {
            if (type === LinkifyMatrixOpaqueIdType.URL && urlTargetTransformer) {
                return urlTargetTransformer(href);
            }
            return "_blank";
        },
        ...(hrefTransformer
            ? {
                  formatHref: (href, type) => hrefTransformer(href, type as LinkifyMatrixOpaqueIdType),
              }
            : undefined),
        // By default, ignore Matrix ID types.
        // Other applications may implement their own version of LinkifyComponent.
        validate: (_value, type: string) =>
            !!(type === LinkifyMatrixOpaqueIdType.UserId && userIdListener) ||
            !!(type === LinkifyMatrixOpaqueIdType.RoomAlias && roomAliasListener) ||
            type === LinkifyMatrixOpaqueIdType.URL,
    } satisfies linkifyjs.Opts;
}

/**
 * Finds all links in a given string.
 *
 * @param str A string that may contain one or more strings.
 * @returns A set of all links in the string.
 */
export function findLinksInString(str: string): ReturnType<typeof linkifyjs.find> {
    return linkifyjs.find(str);
}

/**
 * Is the given string considered linkable, as in it looks
 * like a URL and uses a permitted protocol.
 * This does not trim the string.
 *
 * @param str A string value to be tested if the entire value is linkable.
 * @returns Whether or not the `str` value is a link.
 * @see `PERMITTED_URL_SCHEMES` for permitted links.
 */
export function isLinkable(str: string): boolean {
    return linkifyjs.test(str);
}

/**
 * `data-linkified` is applied to all links generated by the linkifaction functions and `<LinkedText>`.
 */
export const LINKIFIED_DATA_ATTRIBUTE = "linkified";

export { default as linkifyString } from "linkify-string";
export { default as linkifyHtml } from "linkify-html";
