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

'use strict';

function tsOfNewestEvent(room) {
    if (room.timeline.length) {
        return room.timeline[room.timeline.length - 1].getTs();
    }
    else {
        return Number.MAX_SAFE_INTEGER;
    }
}

function mostRecentActivityFirst(roomList) {
    return roomList.sort(function(a,b) {
        return tsOfNewestEvent(b) - tsOfNewestEvent(a);
    });
}

module.exports = {
    mostRecentActivityFirst: mostRecentActivityFirst
};
