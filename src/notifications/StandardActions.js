/*
Copyright 2016 OpenMarket Ltd

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

var NotificationUtils = require('./NotificationUtils');

var encodeActions = NotificationUtils.encodeActions;

module.exports = {
    ACTION_NOTIFY: encodeActions({notify: true}),
    ACTION_NOTIFY_DEFAULT_SOUND: encodeActions({notify: true, sound: "default"}),
    ACTION_NOTIFY_RING_SOUND: encodeActions({notify: true, sound: "ring"}),
    ACTION_HIGHLIGHT_DEFAULT_SOUND: encodeActions({notify: true, sound: "default", highlight: true}),
    ACTION_DONT_NOTIFY: encodeActions({notify: false}),
    ACTION_DISABLED: null,
};
