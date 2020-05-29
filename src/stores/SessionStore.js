/*
Copyright 2017 Vector Creations Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import dis from '../dispatcher/dispatcher';
import {Store} from 'flux/utils';

const INITIAL_STATE = {
    cachedPassword: localStorage.getItem('mx_pass'),
};

/**
 * A class for storing application state to do with the session. This is a simple flux
 * store that listens for actions and updates its state accordingly, informing any
 * listeners (views) of state changes.
 *
 * Usage:
 *  ```
 *  sessionStore.addListener(() => {
 *   this.setState({ cachedPassword: sessionStore.getCachedPassword() })
 *  })
 *  ```
 */
class SessionStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = INITIAL_STATE;
    }

    _update() {
        // Persist state to localStorage
        if (this._state.cachedPassword) {
            localStorage.setItem('mx_pass', this._state.cachedPassword);
        } else {
            localStorage.removeItem('mx_pass', this._state.cachedPassword);
        }

        this.__emitChange();
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this._update();
    }

    __onDispatch(payload) {
        switch (payload.action) {
            case 'cached_password':
                this._setState({
                    cachedPassword: payload.cachedPassword,
                });
                break;
            case 'password_changed':
                this._setState({
                    cachedPassword: null,
                });
                break;
            case 'on_client_not_viable':
            case 'on_logged_out':
                this._setState({
                    cachedPassword: null,
                });
                break;
        }
    }

    getCachedPassword() {
        return this._state.cachedPassword;
    }
}

let singletonSessionStore = null;
if (!singletonSessionStore) {
    singletonSessionStore = new SessionStore();
}
export default singletonSessionStore;
