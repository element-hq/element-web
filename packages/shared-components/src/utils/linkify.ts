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
 * URL schemes that are safe to be resolved within the context of a Matrix client.
 */
export const PERMITTED_URL_SCHEMES = [
    "bitcoin",
    "ftp",
    "geo",
    "http",
    "https",
    "im",
    "irc",
    "ircs",
    "magnet",
    "mailto",
    "matrix",
    "mms",
    "news",
    "nntp",
    "openpgp4fpr",
    "sip",
    "sftp",
    "sms",
    "smsto",
    "ssh",
    "tel",
    "urn",
    "webcal",
    "wtai",
    "xmpp",
];

// Linkify supports some common protocols but not others, register all permitted url schemes if unsupported
// https://github.com/nfrasser/linkifyjs/blob/main/packages/linkifyjs/src/scanner.mjs#L171-L177
// This also handles registering the `matrix:` protocol scheme
PERMITTED_URL_SCHEMES.forEach((scheme) => {
    if (!LinkifySupportedProtocols.includes(scheme)) {
        linkifyjs.registerCustomProtocol(scheme, LinkifyOptionalSlashProtocols.includes(scheme));
    }
});

// MXC urls can be resolved, but are not permitted in other parts of the app.
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

// Export our instances of linkify to ensure there is a singular instance of it.
export { default as linkifyString } from "linkify-string";
export { default as linkifyHtml } from "linkify-html";
export { default as LinkifyComponent } from "linkify-react";

export { linkifyjs };
