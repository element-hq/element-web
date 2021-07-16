/*
Copyright 2017 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { asyncAction } from './actionCreators';
import { AsyncActionPayload } from "../dispatcher/payloads";
import { MatrixClient } from "matrix-js-sdk/src/client";

export default class GroupActions {
    /**
     * Creates an action thunk that will do an asynchronous request to fetch
     * the groups to which a user is joined.
     *
     * @param {MatrixClient} matrixClient the matrix client to query.
     * @returns {AsyncActionPayload} An async action payload.
     * @see asyncAction
     */
    public static fetchJoinedGroups(matrixClient: MatrixClient): AsyncActionPayload {
        return asyncAction('GroupActions.fetchJoinedGroups', () => matrixClient.getJoinedGroups(), null);
    }
}
