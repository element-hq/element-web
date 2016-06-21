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

module.exports = {
    /**
     * Given a room object, return the alias we should use for it,
     * if any. This could be the canonical alias if one exists, otherwise
     * an alias selected arbitrarily but deterministically from the list
     * of aliases. Otherwise return null;
     */
    getDisplayAliasForRoom: function(room) {
        return room.getCanonicalAlias() || room.getAliases()[0];
    },
}

