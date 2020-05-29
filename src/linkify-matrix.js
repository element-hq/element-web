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

import {baseUrl} from "./utils/permalinks/SpecPermalinkConstructor";
import {
    parsePermalink,
    tryTransformEntityToPermalink,
    tryTransformPermalinkToLocalHref,
} from "./utils/permalinks/Permalinks";

function matrixLinkify(linkify) {
    // Text tokens
    const TT = linkify.scanner.TOKENS;
    // Multi tokens
    const MT = linkify.parser.TOKENS;
    const MultiToken = MT.Base;
    const S_START = linkify.parser.start;

    if (TT.UNDERSCORE === undefined) {
        throw new Error("linkify-matrix requires linkifyjs 2.1.1: this version is too old.");
    }

    const ROOMALIAS = function(value) {
        MultiToken.call(this, value);
        this.type = 'roomalias';
        this.isLink = true;
    };
    ROOMALIAS.prototype = new MultiToken();

    const S_HASH = S_START.jump(TT.POUND);
    const S_HASH_NAME = new linkify.parser.State();
    const S_HASH_NAME_COLON = new linkify.parser.State();
    const S_HASH_NAME_COLON_DOMAIN = new linkify.parser.State(ROOMALIAS);
    const S_HASH_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    const S_ROOMALIAS = new linkify.parser.State(ROOMALIAS);
    const S_ROOMALIAS_COLON = new linkify.parser.State();
    const S_ROOMALIAS_COLON_NUM = new linkify.parser.State(ROOMALIAS);

    const roomnameTokens = [
        TT.DOT,
        TT.PLUS,
        TT.NUM,
        TT.DOMAIN,
        TT.TLD,
        TT.UNDERSCORE,
        TT.POUND,

        // because 'localhost' is tokenised to the localhost token,
        // usernames @localhost:foo.com are otherwise not matched!
        TT.LOCALHOST,
    ];

    S_HASH.on(roomnameTokens, S_HASH_NAME);
    S_HASH_NAME.on(roomnameTokens, S_HASH_NAME);
    S_HASH_NAME.on(TT.DOMAIN, S_HASH_NAME);

    S_HASH_NAME.on(TT.COLON, S_HASH_NAME_COLON);

    S_HASH_NAME_COLON.on(TT.DOMAIN, S_HASH_NAME_COLON_DOMAIN);
    S_HASH_NAME_COLON.on(TT.LOCALHOST, S_ROOMALIAS); // accept #foo:localhost
    S_HASH_NAME_COLON.on(TT.TLD, S_ROOMALIAS); // accept #foo:com (mostly for (TLD|DOMAIN)+ mixing)
    S_HASH_NAME_COLON_DOMAIN.on(TT.DOT, S_HASH_NAME_COLON_DOMAIN_DOT);
    S_HASH_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_HASH_NAME_COLON_DOMAIN);
    S_HASH_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_ROOMALIAS);

    S_ROOMALIAS.on(TT.DOT, S_HASH_NAME_COLON_DOMAIN_DOT); // accept repeated TLDs (e.g .org.uk)
    S_ROOMALIAS.on(TT.COLON, S_ROOMALIAS_COLON); // do not accept trailing `:`
    S_ROOMALIAS_COLON.on(TT.NUM, S_ROOMALIAS_COLON_NUM); // but do accept :NUM (port specifier)


    const USERID = function(value) {
        MultiToken.call(this, value);
        this.type = 'userid';
        this.isLink = true;
    };
    USERID.prototype = new MultiToken();

    const S_AT = S_START.jump(TT.AT);
    const S_AT_NAME = new linkify.parser.State();
    const S_AT_NAME_COLON = new linkify.parser.State();
    const S_AT_NAME_COLON_DOMAIN = new linkify.parser.State(USERID);
    const S_AT_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    const S_USERID = new linkify.parser.State(USERID);
    const S_USERID_COLON = new linkify.parser.State();
    const S_USERID_COLON_NUM = new linkify.parser.State(USERID);

    const usernameTokens = [
        TT.DOT,
        TT.UNDERSCORE,
        TT.PLUS,
        TT.NUM,
        TT.DOMAIN,
        TT.TLD,

        // as in roomnameTokens
        TT.LOCALHOST,
    ];

    S_AT.on(usernameTokens, S_AT_NAME);
    S_AT_NAME.on(usernameTokens, S_AT_NAME);
    S_AT_NAME.on(TT.DOMAIN, S_AT_NAME);

    S_AT_NAME.on(TT.COLON, S_AT_NAME_COLON);

    S_AT_NAME_COLON.on(TT.DOMAIN, S_AT_NAME_COLON_DOMAIN);
    S_AT_NAME_COLON.on(TT.LOCALHOST, S_USERID); // accept @foo:localhost
    S_AT_NAME_COLON.on(TT.TLD, S_USERID); // accept @foo:com (mostly for (TLD|DOMAIN)+ mixing)
    S_AT_NAME_COLON_DOMAIN.on(TT.DOT, S_AT_NAME_COLON_DOMAIN_DOT);
    S_AT_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_AT_NAME_COLON_DOMAIN);
    S_AT_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_USERID);

    S_USERID.on(TT.DOT, S_AT_NAME_COLON_DOMAIN_DOT); // accept repeated TLDs (e.g .org.uk)
    S_USERID.on(TT.COLON, S_USERID_COLON); // do not accept trailing `:`
    S_USERID_COLON.on(TT.NUM, S_USERID_COLON_NUM); // but do accept :NUM (port specifier)


    const GROUPID = function(value) {
        MultiToken.call(this, value);
        this.type = 'groupid';
        this.isLink = true;
    };
    GROUPID.prototype = new MultiToken();

    const S_PLUS = S_START.jump(TT.PLUS);
    const S_PLUS_NAME = new linkify.parser.State();
    const S_PLUS_NAME_COLON = new linkify.parser.State();
    const S_PLUS_NAME_COLON_DOMAIN = new linkify.parser.State(GROUPID);
    const S_PLUS_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    const S_GROUPID = new linkify.parser.State(GROUPID);
    const S_GROUPID_COLON = new linkify.parser.State();
    const S_GROUPID_COLON_NUM = new linkify.parser.State(GROUPID);

    const groupIdTokens = [
        TT.DOT,
        TT.UNDERSCORE,
        TT.PLUS,
        TT.NUM,
        TT.DOMAIN,
        TT.TLD,

        // as in roomnameTokens
        TT.LOCALHOST,
    ];

    S_PLUS.on(groupIdTokens, S_PLUS_NAME);
    S_PLUS_NAME.on(groupIdTokens, S_PLUS_NAME);
    S_PLUS_NAME.on(TT.DOMAIN, S_PLUS_NAME);

    S_PLUS_NAME.on(TT.COLON, S_PLUS_NAME_COLON);

    S_PLUS_NAME_COLON.on(TT.DOMAIN, S_PLUS_NAME_COLON_DOMAIN);
    S_PLUS_NAME_COLON.on(TT.LOCALHOST, S_GROUPID); // accept +foo:localhost
    S_PLUS_NAME_COLON.on(TT.TLD, S_GROUPID); // accept +foo:com (mostly for (TLD|DOMAIN)+ mixing)
    S_PLUS_NAME_COLON_DOMAIN.on(TT.DOT, S_PLUS_NAME_COLON_DOMAIN_DOT);
    S_PLUS_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_PLUS_NAME_COLON_DOMAIN);
    S_PLUS_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_GROUPID);

    S_GROUPID.on(TT.DOT, S_PLUS_NAME_COLON_DOMAIN_DOT); // accept repeated TLDs (e.g .org.uk)
    S_GROUPID.on(TT.COLON, S_GROUPID_COLON); // do not accept trailing `:`
    S_GROUPID_COLON.on(TT.NUM, S_GROUPID_COLON_NUM); // but do accept :NUM (port specifier)
}

// stubs, overwritten in MatrixChat's componentDidMount
matrixLinkify.onUserClick = function(e, userId) { e.preventDefault(); };
matrixLinkify.onAliasClick = function(e, roomAlias) { e.preventDefault(); };
matrixLinkify.onGroupClick = function(e, groupId) { e.preventDefault(); };

const escapeRegExp = function(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Recognise URLs from both our local vector and official vector as vector.
// anyone else really should be using matrix.to.
matrixLinkify.VECTOR_URL_PATTERN = "^(?:https?://)?(?:"
    + escapeRegExp(window.location.host + window.location.pathname) + "|"
    + "(?:www\\.)?(?:riot|vector)\\.im/(?:app|beta|staging|develop)/"
    + ")(#.*)";

matrixLinkify.MATRIXTO_URL_PATTERN = "^(?:https?://)?(?:www\\.)?matrix\\.to/#/(([#@!+]).*)";
matrixLinkify.MATRIXTO_MD_LINK_PATTERN =
    '\\[([^\\]]*)\\]\\((?:https?://)?(?:www\\.)?matrix\\.to/#/([#@!+][^\\)]*)\\)';
matrixLinkify.MATRIXTO_BASE_URL= baseUrl;

matrixLinkify.options = {
    events: function(href, type) {
        switch (type) {
            case "url": {
                // intercept local permalinks to users and show them like userids (in userinfo of current room)
                try {
                    const permalink = parsePermalink(href);
                    if (permalink && permalink.userId) {
                        return {
                            click: function(e) {
                                matrixLinkify.onUserClick(e, permalink.userId);
                            },
                        };
                    }
                } catch (e) {
                    // OK fine, it's not actually a permalink
                }
                break;
            }
            case "userid":
                return {
                    click: function(e) {
                        matrixLinkify.onUserClick(e, href);
                    },
                };
            case "roomalias":
                return {
                    click: function(e) {
                        matrixLinkify.onAliasClick(e, href);
                    },
                };
            case "groupid":
                return {
                    click: function(e) {
                        matrixLinkify.onGroupClick(e, href);
                    },
                };
        }
    },

    formatHref: function(href, type) {
        switch (type) {
            case 'roomalias':
            case 'userid':
            case 'groupid':
            default: {
                return tryTransformEntityToPermalink(href);
            }
        }
    },

    linkAttributes: {
        rel: 'noreferrer noopener',
    },

    target: function(href, type) {
        if (type === 'url') {
            const transformed = tryTransformPermalinkToLocalHref(href);
            if (transformed !== href || href.match(matrixLinkify.VECTOR_URL_PATTERN)) {
                return null;
            } else {
                return '_blank';
            }
        }
        return null;
    },
};

export default matrixLinkify;
