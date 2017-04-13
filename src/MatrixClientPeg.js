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

import q from "q";
import Matrix from 'matrix-js-sdk';
import utils from 'matrix-js-sdk/lib/utils';
import EventTimeline from 'matrix-js-sdk/lib/models/event-timeline';
import EventTimelineSet from 'matrix-js-sdk/lib/models/event-timeline-set';

const localStorage = window.localStorage;

interface MatrixClientCreds {
    homeserverUrl: string,
    identityServerUrl: string,
    userId: string,
    deviceId: string,
    accessToken: string,
    guest: boolean,
}

/**
 * Wrapper object for handling the js-sdk Matrix Client object in the react-sdk
 * Handles the creation/initialisation of client objects.
 * This module provides a singleton instance of this class so the 'current'
 * Matrix Client object is available easily.
 */
class MatrixClientPeg {
    constructor() {
        this.matrixClient = null;

        // These are the default options used when when the
        // client is started in 'start'. These can be altered
        // at any time up to after the 'will_start_client'
        // event is finished processing.
        this.opts = {
            initialSyncLimit: 20,
        };
        this.indexedDbWorkerScript = null;
    }

    /**
     * Sets the script href passed to the IndexedDB web worker
     * If set, a separate web worker will be started to run the IndexedDB
     * queries on.
     *
     * @param {string} script href to the script to be passed to the web worker
     */
    setIndexedDbWorkerScript(script) {
        this.indexedDbWorkerScript = script;
    }

    get(): MatrixClient {
        return this.matrixClient;
    }

    unset() {
        this.matrixClient = null;
    }

    /**
     * Replace this MatrixClientPeg's client with a client instance that has
     * Home Server / Identity Server URLs and active credentials
     */
    replaceUsingCreds(creds: MatrixClientCreds) {
        this._createClient(creds);
    }

    start() {
        const opts = utils.deepCopy(this.opts);
        // the react sdk doesn't work without this, so don't allow
        opts.pendingEventOrdering = "detached";

        let promise = this.matrixClient.store.startup();
        // log any errors when starting up the database (if one exists)
        promise.catch((err) => { console.error(err); });

        // regardless of errors, start the client. If we did error out, we'll
        // just end up doing a full initial /sync.
        promise.finally(() => {
            this.get().startClient(opts);
        });
    }

    getCredentials(): MatrixClientCreds {
        return {
            homeserverUrl: this.matrixClient.baseUrl,
            identityServerUrl: this.matrixClient.idBaseUrl,
            userId: this.matrixClient.credentials.userId,
            deviceId: this.matrixClient.getDeviceId(),
            accessToken: this.matrixClient.getAccessToken(),
            guest: this.matrixClient.isGuest(),
        };
    }

    /**
     * Return the server name of the user's home server
     * Throws an error if unable to deduce the home server name
     * (eg. if the user is not logged in)
     */
    getHomeServerName() {
        const matches = /^@.+:(.+)$/.exec(this.matrixClient.credentials.userId);
        if (matches === null || matches.length < 1) {
            throw new Error("Failed to derive home server name from user ID!");
        }
        return matches[1];
    }

    _createClient(creds: MatrixClientCreds) {
        var opts = {
            baseUrl: creds.homeserverUrl,
            idBaseUrl: creds.identityServerUrl,
            accessToken: creds.accessToken,
            userId: creds.userId,
            deviceId: creds.deviceId,
            timelineSupport: true,
        };

        if (localStorage) {
            opts.sessionStore = new Matrix.WebStorageSessionStore(localStorage);
        }
        if (window.indexedDB && localStorage) {
            // FIXME: bodge to remove old database. Remove this after a few weeks.
            window.indexedDB.deleteDatabase("matrix-js-sdk:default");

            opts.store = new Matrix.IndexedDBStore({
                indexedDB: window.indexedDB,
                dbName: "riot-web-sync",
                localStorage: localStorage,
                workerScript: this.indexedDbWorkerScript,
            });
        }

        this.matrixClient = Matrix.createClient(opts);

        // we're going to add eventlisteners for each matrix event tile, so the
        // potential number of event listeners is quite high.
        this.matrixClient.setMaxListeners(500);

        this.matrixClient.setGuest(Boolean(creds.guest));

        var notifTimelineSet = new EventTimelineSet(null, {
            timelineSupport: true
        });
        // XXX: what is our initial pagination token?! it somehow needs to be synchronised with /sync.
        notifTimelineSet.getLiveTimeline().setPaginationToken("", EventTimeline.BACKWARDS);
        this.matrixClient.setNotifTimelineSet(notifTimelineSet);
    }
}

if (!global.mxMatrixClientPeg) {
    global.mxMatrixClientPeg = new MatrixClientPeg();
}
module.exports = global.mxMatrixClientPeg;
