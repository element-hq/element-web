/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import * as linkifyjs from "linkifyjs";
import { default as linkifyString } from "linkify-string"; // Only exported by this file, but imported for jsdoc.
import { default as linkifyHtml } from "linkify-html"; // Only exported by this file, but imported for jsdoc.

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

export enum LinkifyMatrixOpaqueIdType {
    URL = "url",
    UserId = "userid",
    RoomAlias = "roomalias",
}

/**
 * Plugin function for linkifyjs to find Matrix Room or User IDs.
 *
 * Should be used exclusively by a `registerPlugin` function call.
 */
function parseOpaqueIdsToMatrixIds({
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

    const initialState = parser.start.tt(token);

    // Localpart
    const localpartState = new linkifyjs.State<linkifyjs.MultiToken>();
    initialState.ta(domain, localpartState);
    initialState.ta(additionalLocalpartTokens, localpartState);
    localpartState.ta(domain, localpartState);
    localpartState.ta(additionalLocalpartTokens, localpartState);

    // Domainpart
    const domainStateDot = localpartState.tt(COLON);
    domainStateDot.ta(domain, matrixTokenState);
    domainStateDot.ta(additionalDomainpartTokens, matrixTokenState);
    matrixTokenState.ta(domain, matrixTokenState);
    matrixTokenState.ta(additionalDomainpartTokens, matrixTokenState);
    matrixTokenState.tt(DOT, domainStateDot);

    // Port suffixes
    matrixTokenState.tt(COLON).tt(NUM, matrixTokenWithPortState);
}

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
 * @return A `linkifyjs` `Opts` object. Used by `linkifyString` and `linkifyHtml
 * @see {@link linkifyHtml}
 * @see {@link linkifyString}
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
 * Is the provided value something that would be converted to a clickable
 * link.
 *
 * E.g. 'https://matrix.org', `matrix.org` or 'example@matrix.org'
 *
 * @param str A string value to be tested if the entire value is linkable.
 * @returns Whether or not the `str` value is a link.
 * @see `PERMITTED_URL_SCHEMES` for permitted links.
 * @see {@link linkifyjs.test}
 */
export function isLinkable(str: string): boolean {
    return linkifyjs.test(str);
}

/**
 * `data-linkified` is applied to all links generated by the linkifaction functions and `<LinkedText>`.
 */
export const LINKIFIED_DATA_ATTRIBUTE = "linkified";

export { linkifyString, linkifyHtml };

// Linkifyjs MUST be configured globally as it has no ability to be instanced seperately
// so we ensure it's always configured the same way.
let linkifyJSConfigured = false;
function configureLinkifyJS(): void {
    if (linkifyJSConfigured) {
        return;
    }
    // Register plugins
    linkifyjs.registerPlugin(LinkifyMatrixOpaqueIdType.RoomAlias, ({ scanner, parser }) => {
        const token = scanner.tokens.POUND as "#";
        parseOpaqueIdsToMatrixIds({
            scanner,
            parser,
            token,
            name: LinkifyMatrixOpaqueIdType.RoomAlias,
        });
    });

    linkifyjs.registerPlugin(LinkifyMatrixOpaqueIdType.UserId, ({ scanner, parser }) => {
        const token = scanner.tokens.AT as "@";
        parseOpaqueIdsToMatrixIds({
            scanner,
            parser,
            token,
            name: LinkifyMatrixOpaqueIdType.UserId,
        });
    });

    // 'mxc' is specialcased. They can be linked to
    linkifyjs.registerCustomProtocol("mxc", false);

    // Linkify supports some common protocols but not others, register all permitted url schemes if unsupported
    // https://github.com/nfrasser/linkifyjs/blob/main/packages/linkifyjs/src/scanner.mjs#L171-L177
    // This also handles registering the `matrix:` protocol scheme
    PERMITTED_URL_SCHEMES.forEach((scheme) => {
        if (!LinkifySupportedProtocols.includes(scheme)) {
            linkifyjs.registerCustomProtocol(scheme, LinkifyOptionalSlashProtocols.includes(scheme));
        }
    });
    linkifyJSConfigured = true;
}

configureLinkifyJS();
