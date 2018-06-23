/*
Copyright 2015, 2016 OpenMarket Ltd

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

import {baseUrl} from "./matrix-to";

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

    const S_HASH = new linkify.parser.State();
    const S_HASH_NAME = new linkify.parser.State();
    const S_HASH_NAME_COLON = new linkify.parser.State();
    const S_HASH_NAME_COLON_DOMAIN = new linkify.parser.State();
    const S_HASH_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    const S_ROOMALIAS = new linkify.parser.State(ROOMALIAS);

    const roomname_tokens = [
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

    S_START.on(TT.POUND, S_HASH);

    S_HASH.on(roomname_tokens, S_HASH_NAME);
    S_HASH_NAME.on(roomname_tokens, S_HASH_NAME);
    S_HASH_NAME.on(TT.DOMAIN, S_HASH_NAME);

    S_HASH_NAME.on(TT.COLON, S_HASH_NAME_COLON);

    S_HASH_NAME_COLON.on(TT.DOMAIN, S_HASH_NAME_COLON_DOMAIN);
    S_HASH_NAME_COLON.on(TT.LOCALHOST, S_ROOMALIAS); // accept #foo:localhost
    S_HASH_NAME_COLON.on(TT.TLD, S_ROOMALIAS); // accept #foo:com (mostly for (TLD|DOMAIN)+ mixing)
    S_HASH_NAME_COLON_DOMAIN.on(TT.DOT, S_HASH_NAME_COLON_DOMAIN_DOT);
    S_HASH_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_HASH_NAME_COLON_DOMAIN);
    S_HASH_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_ROOMALIAS);

    S_ROOMALIAS.on(TT.DOT, S_HASH_NAME_COLON_DOMAIN_DOT); // accept repeated TLDs (e.g .org.uk)


    const USERID = function(value) {
        MultiToken.call(this, value);
        this.type = 'userid';
        this.isLink = true;
    };
    USERID.prototype = new MultiToken();

    const S_AT = new linkify.parser.State();
    const S_AT_NAME = new linkify.parser.State();
    const S_AT_NAME_COLON = new linkify.parser.State();
    const S_AT_NAME_COLON_DOMAIN = new linkify.parser.State();
    const S_AT_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    const S_USERID = new linkify.parser.State(USERID);

    const username_tokens = [
        TT.DOT,
        TT.UNDERSCORE,
        TT.PLUS,
        TT.NUM,
        TT.DOMAIN,
        TT.TLD,

        // as in roomname_tokens
        TT.LOCALHOST,
    ];

    S_START.on(TT.AT, S_AT);

    S_AT.on(username_tokens, S_AT_NAME);
    S_AT_NAME.on(username_tokens, S_AT_NAME);
    S_AT_NAME.on(TT.DOMAIN, S_AT_NAME);

    S_AT_NAME.on(TT.COLON, S_AT_NAME_COLON);

    S_AT_NAME_COLON.on(TT.DOMAIN, S_AT_NAME_COLON_DOMAIN);
    S_AT_NAME_COLON.on(TT.LOCALHOST, S_USERID); // accept @foo:localhost
    S_AT_NAME_COLON.on(TT.TLD, S_USERID); // accept @foo:com (mostly for (TLD|DOMAIN)+ mixing)
    S_AT_NAME_COLON_DOMAIN.on(TT.DOT, S_AT_NAME_COLON_DOMAIN_DOT);
    S_AT_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_AT_NAME_COLON_DOMAIN);
    S_AT_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_USERID);

    S_USERID.on(TT.DOT, S_AT_NAME_COLON_DOMAIN_DOT); // accept repeated TLDs (e.g .org.uk)


    const GROUPID = function(value) {
        MultiToken.call(this, value);
        this.type = 'groupid';
        this.isLink = true;
    };
    GROUPID.prototype = new MultiToken();

    const S_PLUS = new linkify.parser.State();
    const S_PLUS_NAME = new linkify.parser.State();
    const S_PLUS_NAME_COLON = new linkify.parser.State();
    const S_PLUS_NAME_COLON_DOMAIN = new linkify.parser.State();
    const S_PLUS_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    const S_GROUPID = new linkify.parser.State(GROUPID);

    const groupid_tokens = [
        TT.DOT,
        TT.UNDERSCORE,
        TT.PLUS,
        TT.NUM,
        TT.DOMAIN,
        TT.TLD,

        // as in roomname_tokens
        TT.LOCALHOST,
    ];

    S_START.on(TT.PLUS, S_PLUS);

    S_PLUS.on(groupid_tokens, S_PLUS_NAME);
    S_PLUS_NAME.on(groupid_tokens, S_PLUS_NAME);
    S_PLUS_NAME.on(TT.DOMAIN, S_PLUS_NAME);

    S_PLUS_NAME.on(TT.COLON, S_PLUS_NAME_COLON);

    S_PLUS_NAME_COLON.on(TT.DOMAIN, S_PLUS_NAME_COLON_DOMAIN);
    S_PLUS_NAME_COLON.on(TT.LOCALHOST, S_GROUPID); // accept +foo:localhost
    S_PLUS_NAME_COLON.on(TT.TLD, S_GROUPID); // accept +foo:com (mostly for (TLD|DOMAIN)+ mixing)
    S_PLUS_NAME_COLON_DOMAIN.on(TT.DOT, S_PLUS_NAME_COLON_DOMAIN_DOT);
    S_PLUS_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_PLUS_NAME_COLON_DOMAIN);
    S_PLUS_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_GROUPID);

    S_GROUPID.on(TT.DOT, S_PLUS_NAME_COLON_DOMAIN_DOT); // accept repeated TLDs (e.g .org.uk)
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
matrixLinkify.VECTOR_URL_PATTERN = "^(?:https?:\/\/)?(?:"
    + escapeRegExp(window.location.host + window.location.pathname) + "|"
    + "(?:www\\.)?(?:riot|vector)\\.im/(?:app|beta|staging|develop)/"
    + ")(#.*)";

matrixLinkify.MATRIXTO_URL_PATTERN = "^(?:https?:\/\/)?(?:www\\.)?matrix\\.to/#/(([#@!+]).*)";
matrixLinkify.MATRIXTO_MD_LINK_PATTERN =
    '\\[([^\\]]*)\\]\\((?:https?:\/\/)?(?:www\\.)?matrix\\.to/#/([#@!+][^\\)]*)\\)';
matrixLinkify.MATRIXTO_BASE_URL= baseUrl;

const matrixToEntityMap = {
    '@': '#/user/',
    '#': '#/room/',
    '!': '#/room/',
    '+': '#/group/',
};

matrixLinkify.options = {
    events: function(href, type) {
        switch (type) {
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
                return matrixLinkify.MATRIXTO_BASE_URL + '/#/' + href;
            default: {
                // FIXME: horrible duplication with HtmlUtils' transform tags
                let m = href.match(matrixLinkify.VECTOR_URL_PATTERN);
                if (m) {
                    return m[1];
                }
                m = href.match(matrixLinkify.MATRIXTO_URL_PATTERN);
                if (m) {
                    const entity = m[1];
                    if (matrixToEntityMap[entity[0]]) return matrixToEntityMap[entity[0]] + entity;
                }

                return href;
            }
        }
    },

    linkAttributes: {
        rel: 'noopener',
    },

    target: function(href, type) {
        if (type === 'url') {
            if (href.match(matrixLinkify.VECTOR_URL_PATTERN) ||
                href.match(matrixLinkify.MATRIXTO_URL_PATTERN)) {
                return null;
            } else {
                return '_blank';
            }
        }
        return null;
    },
};

module.exports = matrixLinkify;
