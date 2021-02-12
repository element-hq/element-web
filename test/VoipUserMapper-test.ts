/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { userToVirtualUser, virtualUserToUser } from '../src/VoipUserMapper';

const templateString = '@_greatappservice_${mxid}:frooble.example';
const realUser = '@alice:boop.example';
const virtualUser = "@_greatappservice_=40alice=3aboop.example:frooble.example";

describe('VoipUserMapper', function() {
    it('translates users to virtual users', function() {
        expect(userToVirtualUser(realUser, templateString)).toEqual(virtualUser);
    });

    it('translates users to virtual users', function() {
        expect(virtualUserToUser(virtualUser, templateString)).toEqual(realUser);
    });
});
