// @flow
import BaseIntegrationManager from './BaseIntegrationManager';

// index.js imports us unconditionally, so we need this check here as well
let electron = null, remote = null;
if (window && window.process && window.process && window.process.type === 'renderer') {
    electron = require('electron');
    remote = electron.remote;
}

export default class ElectronIntegrationManager extends BaseIntegrationManager {
    setNotificationCount(count: number) {
        super.setNotificationCount(count);
        remote.app.setBadgeCount(count);
    }
}
