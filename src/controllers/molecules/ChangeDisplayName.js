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

module.exports = {
    getDefaultProps: function() {
        return {
            onFinished: function() {},
        };
    },

    getInitialState: function() {
        return {
            busy: false,
            errorString: null
        }
    },

    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        this.setState({busy: true});
        var self = this;
        cli.getProfileInfo(cli.credentials.userId).done(function(result) {
            self.setState({
                displayName: result.displayname,
                busy: false
            });
        }, function(error) {
            self.setState({
                errorString: "Failed to fetch display name",
                busy: false
            });
        });
    },

    changeDisplayname: function(new_displayname) {
        this.setState({
            busy: true,
            errorString: null,
        })

        var self = this;
        MatrixClientPeg.get().setDisplayName(new_displayname).then(function() {
            self.setState({
                busy: false,
                displayName: new_displayname
            });
        }, function(error) {
            self.setState({
                busy: false,
                errorString: "Failed to set display name"
            });
        });
    },
}
