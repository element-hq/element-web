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

var dis = require("../../dispatcher");
var Modal = require("../../Modal");
var ComponentBroker = require('../../ComponentBroker');
var QuestionDialog = ComponentBroker.get("organisms/QuestionDialog");
var Loader = require("react-loader");

var MatrixClientPeg = require("../../MatrixClientPeg");

module.exports = {
    // onClick: function() {
    //     dis.dispatch({
    //         action: 'view_user',
    //         user_id: this.props.member.userId
    //     });
    // },

    getInitialState: function() {
        return {
            hover: false,
        }
    },
};
