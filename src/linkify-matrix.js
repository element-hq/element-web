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

function matrixLinkify(linkify) {
    // Text tokens
    var TT = linkify.scanner.TOKENS;
    // Multi tokens
    var MT = linkify.parser.TOKENS;
    var MultiToken = MT.Base;
    var S_START = linkify.parser.start;


    var ROOMALIAS = function(value) {
        MultiToken.call(this, value);
        this.type = 'roomalias';
        this.isLink = true;
    };
    ROOMALIAS.prototype = new MultiToken();

    var S_HASH = new linkify.parser.State();
    var S_HASH_NAME = new linkify.parser.State();
    var S_HASH_NAME_COLON = new linkify.parser.State();
    var S_HASH_NAME_COLON_DOMAIN = new linkify.parser.State();
    var S_HASH_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    var S_ROOMALIAS = new linkify.parser.State(ROOMALIAS);

    var roomname_tokens = [
        TT.DOT,
        TT.PLUS,
        TT.NUM,
        TT.DOMAIN,
        TT.TLD
    ];

    S_START.on(TT.POUND, S_HASH);

    S_HASH.on(roomname_tokens, S_HASH_NAME);
    S_HASH_NAME.on(roomname_tokens, S_HASH_NAME);
    S_HASH_NAME.on(TT.DOMAIN, S_HASH_NAME);

    S_HASH_NAME.on(TT.COLON, S_HASH_NAME_COLON);

    S_HASH_NAME_COLON.on(TT.DOMAIN, S_HASH_NAME_COLON_DOMAIN);
    S_HASH_NAME_COLON_DOMAIN.on(TT.DOT, S_HASH_NAME_COLON_DOMAIN_DOT);
    S_HASH_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_HASH_NAME_COLON_DOMAIN);
    S_HASH_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_ROOMALIAS);


    var USERID = function(value) {
        MultiToken.call(this, value);
        this.type = 'userid';
        this.isLink = true;
    };
    USERID.prototype = new MultiToken();

    var S_AT = new linkify.parser.State();
    var S_AT_NAME = new linkify.parser.State();
    var S_AT_NAME_COLON = new linkify.parser.State();
    var S_AT_NAME_COLON_DOMAIN = new linkify.parser.State();
    var S_AT_NAME_COLON_DOMAIN_DOT = new linkify.parser.State();
    var S_USERID = new linkify.parser.State(USERID);

    var username_tokens = [
        TT.DOT,
        TT.PLUS,
        TT.NUM,
        TT.DOMAIN,
        TT.TLD
    ];

    S_START.on(TT.AT, S_AT);

    S_AT.on(username_tokens, S_AT_NAME);
    S_AT_NAME.on(username_tokens, S_AT_NAME);
    S_AT_NAME.on(TT.DOMAIN, S_AT_NAME);

    S_AT_NAME.on(TT.COLON, S_AT_NAME_COLON);

    S_AT_NAME_COLON.on(TT.DOMAIN, S_AT_NAME_COLON_DOMAIN);
    S_AT_NAME_COLON_DOMAIN.on(TT.DOT, S_AT_NAME_COLON_DOMAIN_DOT);
    S_AT_NAME_COLON_DOMAIN_DOT.on(TT.DOMAIN, S_AT_NAME_COLON_DOMAIN);
    S_AT_NAME_COLON_DOMAIN_DOT.on(TT.TLD, S_USERID);
}

matrixLinkify.onUserClick = function(e, userId) { e.preventDefault(); };
matrixLinkify.onAliasClick = function(e, roomAlias) { e.preventDefault(); };

matrixLinkify.options = {
    events: function (href, type) {
        switch (type) {
            case "userid":
                return {
                    click: function(e) {
                        matrixLinkify.onUserClick(e, href);
                    }
                };
            case "roomalias":
                return {
                    click: function(e) {
                        matrixLinkify.onAliasClick(e, href);
                    }
                };
        }
    }
};

module.exports = matrixLinkify;
