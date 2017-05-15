import dis from '../dispatcher';
import {Store} from 'flux/utils';

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
        this._state = {
            cachedPassword: localStorage.getItem('mx_pass'),
        };
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
module.exports = singletonSessionStore;
