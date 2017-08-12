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

export var ACTION_NOTIFY = encodeActions({notify: true})
export var ACTION_NOTIFY_DEFAULT_SOUND = encodeActions({notify: true, sound: "default"})
export var ACTION_NOTIFY_RING_SOUND = encodeActions({notify: true, sound: "ring"})
export var ACTION_HIGHLIGHT_DEFAULT_SOUND = encodeActions({notify: true, sound: "default", highlight: true})
export var ACTION_DONT_NOTIFY = encodeActions({notify: false})
export var ACTION_DISABLED = null
