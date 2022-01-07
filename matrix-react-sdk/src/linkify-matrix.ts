/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as linkifyjs from 'linkifyjs';
import linkifyElement from 'linkifyjs/element';
import linkifyString from 'linkifyjs/string';
import { RoomMember } from 'matrix-js-sdk/src/models/room-member';

import { baseUrl } from "./utils/permalinks/SpecPermalinkConstructor";
import {
    parsePermalink,
    tryTransformEntityToPermalink,
    tryTransformPermalinkToLocalHref,
} from "./utils/permalinks/Permalinks";
import dis from './dispatcher/dispatcher';
import { Action } from './dispatcher/actions';
import { ViewUserPayload } from './dispatcher/payloads/ViewUserPayload';

enum Type {
    URL = "url",
    UserId = "userid",
    RoomAlias = "roomalias",
    GroupId = "groupid"
}

// Linkifyjs types don't have parser, which really makes this harder.
const linkifyTokens = (linkifyjs as any).scanner.TOKENS;
enum MatrixLinkInitialToken {
    POUND = linkifyTokens.POUND,
    PLUS = linkifyTokens.PLUS,
    AT = linkifyTokens.AT,
}

/**
 * Token should be one of the type of linkify.parser.TOKENS[AT | PLUS | POUND]
 * but due to typing issues it's just not a feasible solution.
 * This problem kind of gets solved in linkify 3.0
 */
function parseFreeformMatrixLinks(linkify, token: MatrixLinkInitialToken, type: Type): void {
    // Text tokens
    const TT = linkify.scanner.TOKENS;
    // Multi tokens
    const MT = linkify.parser.TOKENS;
    const MultiToken = MT.Base;
    const S_START = linkify.parser.start;

    const TOKEN = function(value) {
        MultiToken.call(this, value);
        this.type = type;
        this.isLink = true;
    };
    TOKEN.prototype = new MultiToken();

    const S_TOKEN = S_START.jump(token);
    const S_TOKEN_NAME = new linkify.parser.State();
    const S_TOKEN_NAME_COLON = new linkify.parser.State();
    const S_TOKEN_NAME_COLON_DOMAIN = new linkify.parser.State(TOKEN);
    const S_TOKEN_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    const S_MX_LINK = new linkify.parser.State(TOKEN);
    const S_MX_LINK_COLON = new linkify.parser.State();
    const S_MX_LINK_COLON_NUM = new linkify.parser.State(TOKEN);

    const allowedFreeformTokens = [
        TT.DOT,
        TT.PLUS,
        TT.NUM,
        TT.DOMAIN,
        TT.TLD,
        TT.UNDERSCORE,
        token,

        // because 'localhost' is tokenised to the localhost token,
        // usernames @localhost:foo.com are otherwise not matched!
        TT.LOCALHOST,
    ];

    S_TOKEN.on(allowedFreeformTokens, S_TOKEN_NAME);
    S_TOKEN_NAME.on(allowedFreeformTokens, S_TOKEN_NAME);
    S_TOKEN_NAME.on(TT.DOMAIN, S_TOKEN_NAME);

    S_TOKEN_NAME.on(TT.COLON, S_TOKEN_NAME_COLON);

    S_TOKEN_NAME_COLON.on(TT.DOMAIN, S_TOKEN_NAME_COLON_DOMAIN);
    S_TOKEN_NAME_COLON.on(TT.LOCALHOST, S_MX_LINK); // accept #foo:localhost
    S_TOKEN_NAME_COLON.on(TT.TLD, S_MX_LINK); // accept #foo:com (mostly for (TLD|DOMAIN)+ mixing)
    S_TOKEN_NAME_COLON_DOMAIN.on(TT.DOT, S_TOKEN_NAME_COLON_DOMAIN_DOT);
    S_TOKEN_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_TOKEN_NAME_COLON_DOMAIN);
    S_TOKEN_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_MX_LINK);

    S_MX_LINK.on(TT.DOT, S_TOKEN_NAME_COLON_DOMAIN_DOT); // accept repeated TLDs (e.g .org.uk)
    S_MX_LINK.on(TT.COLON, S_MX_LINK_COLON); // do not accept trailing `:`
    S_MX_LINK_COLON.on(TT.NUM, S_MX_LINK_COLON_NUM); // but do accept :NUM (port specifier)
}

function onUserClick(event: MouseEvent, userId: string) {
    const member = new RoomMember(null, userId);
    if (!member) { return; }
    dis.dispatch<ViewUserPayload>({
        action: Action.ViewUser,
        member: member,
    });
}
function onAliasClick(event: MouseEvent, roomAlias: string) {
    event.preventDefault();
    dis.dispatch({ action: 'view_room', room_alias: roomAlias });
}
function onGroupClick(event: MouseEvent, groupId: string) {
    event.preventDefault();
    dis.dispatch({ action: 'view_group', group_id: groupId });
}

const escapeRegExp = function(string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Recognise URLs from both our local and official Element deployments.
// Anyone else really should be using matrix.to.
export const ELEMENT_URL_PATTERN =
    "^(?:https?://)?(?:" +
        escapeRegExp(window.location.host + window.location.pathname) + "|" +
        "(?:www\\.)?(?:riot|vector)\\.im/(?:app|beta|staging|develop)/|" +
        "(?:app|beta|staging|develop)\\.element\\.io/" +
    ")(#.*)";

export const MATRIXTO_URL_PATTERN = "^(?:https?://)?(?:www\\.)?matrix\\.to/#/(([#@!+]).*)";
export const MATRIXTO_MD_LINK_PATTERN =
    '\\[([^\\]]*)\\]\\((?:https?://)?(?:www\\.)?matrix\\.to/#/([#@!+][^\\)]*)\\)';
export const MATRIXTO_BASE_URL= baseUrl;

export const options = {
    events: function(href: string, type: Type | string): Partial<GlobalEventHandlers> {
        switch (type) {
            case Type.URL: {
                // intercept local permalinks to users and show them like userids (in userinfo of current room)
                try {
                    const permalink = parsePermalink(href);
                    if (permalink && permalink.userId) {
                        return {
                            // @ts-ignore see https://linkify.js.org/docs/options.html
                            click: function(e) {
                                onUserClick(e, permalink.userId);
                            },
                        };
                    }
                } catch (e) {
                    // OK fine, it's not actually a permalink
                }
                break;
            }
            case Type.UserId:
                return {
                    // @ts-ignore see https://linkify.js.org/docs/options.html
                    click: function(e) {
                        onUserClick(e, href);
                    },
                };
            case Type.RoomAlias:
                return {
                    // @ts-ignore see https://linkify.js.org/docs/options.html
                    click: function(e) {
                        onAliasClick(e, href);
                    },
                };
            case Type.GroupId:
                return {
                    // @ts-ignore see https://linkify.js.org/docs/options.html
                    click: function(e) {
                        onGroupClick(e, href);
                    },
                };
        }
    },

    formatHref: function(href: string, type: Type | string): string {
        switch (type) {
            case Type.RoomAlias:
            case Type.UserId:
            case Type.GroupId:
            default: {
                return tryTransformEntityToPermalink(href);
            }
        }
    },

    linkAttributes: {
        rel: 'noreferrer noopener',
    },

    target: function(href: string, type: Type | string): string {
        if (type === Type.URL) {
            try {
                const transformed = tryTransformPermalinkToLocalHref(href);
                if (transformed !== href || decodeURIComponent(href).match(ELEMENT_URL_PATTERN)) {
                    return null;
                } else {
                    return '_blank';
                }
            } catch (e) {
                // malformed URI
            }
        }
        return null;
    },
};

// Run the plugins
// Linkify room aliases
parseFreeformMatrixLinks(linkifyjs, MatrixLinkInitialToken.POUND, Type.RoomAlias);
// Linkify group IDs
parseFreeformMatrixLinks(linkifyjs, MatrixLinkInitialToken.PLUS, Type.GroupId);
// Linkify user IDs
parseFreeformMatrixLinks(linkifyjs, MatrixLinkInitialToken.AT, Type.UserId);

export const linkify = linkifyjs;
export const _linkifyElement = linkifyElement;
export const _linkifyString = linkifyString;
