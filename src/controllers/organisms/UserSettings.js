/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

var MatrixClientPeg = require("../../MatrixClientPeg");
var React = require("react");
var q = require('q');
var dis = require("../../dispatcher");
var version = require('../../../package.json').version;

var ComponentBroker = require('../../ComponentBroker');

module.exports = {
    Phases: {
        Loading: "loading",
        Display: "display",
    },

    getInitialState: function() {
        return {
            displayName: null,
            avatarUrl: null,
            threePids: [],
            clientVersion: version,
            phase: this.Phases.Loading,
        };
    },

    changeDisplayname: function(new_displayname) {
        if (this.state.displayName == new_displayname) return;

        var self = this;
        return MatrixClientPeg.get().setDisplayName(new_displayname).then(
            function() { self.setState({displayName: new_displayname}); },
            function(err) { console.err(err); }
        );
    },

    componentWillMount: function() {
        var self = this;
        var cli = MatrixClientPeg.get();

        var profile_d = cli.getProfileInfo(cli.credentials.userId);
        var threepid_d = cli.getThreePids();

        q.all([profile_d, threepid_d]).then(
            function(resps) {
                self.setState({
                    displayName: resps[0].displayname,
                    avatarUrl: resps[0].avatar_url,
                    threepids: resps[1].threepids,
                    phase: self.Phases.Display,
                });
            },
            function(err) { console.err(err); }
        );
    }
}
