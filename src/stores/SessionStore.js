import dis from '../dispatcher';
import EventEmitter from 'events';

/**
 * A class for storing application state to do with the session. This is a simple flux
 * store that listens for actions and updates its state accordingly, informing any
 * listeners (views) of state changes via the 'update' event.
 */
function SessionStore() {
    // Initialise state
    this._state = {
        cachedPassword: localStorage.getItem('mx_pass'),
    };

    dis.register(this._onAction.bind(this));
}

// Inherit from EventEmitter
SessionStore.prototype = EventEmitter.prototype;

SessionStore.prototype._update = function() {
    // Persist state to localStorage
    if (this._state.cachedPassword) {
        localStorage.setItem('mx_pass', this._state.cachedPassword);
    } else {
        localStorage.removeItem('mx_pass', this._state.cachedPassword);
    }

    this.emit('update');
};

SessionStore.prototype._setState = function(newState) {
    this._state = Object.assign(this._state, newState);
    this._update();
};

SessionStore.prototype._onAction = function(payload) {
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
};

SessionStore.prototype.getCachedPassword = function() {
    return this._state.cachedPassword;
};

// Export singleton getter
let singletonSessionStore = null;
export default function getSessionStore() {
    if (!singletonSessionStore) {
        singletonSessionStore = new SessionStore();
    }
    return singletonSessionStore;
}
