// @flow

import ElectronIntegrationManager from './ElectronIntegrationManager';
import WebIntegrationManager from './WebIntegrationManager';

let IntegrationManager = null;

if (window && window.process && window.process && window.process.type === 'renderer') {
    // we're running inside electron
    IntegrationManager = ElectronIntegrationManager;
} else {
    IntegrationManager = WebIntegrationManager;
}

export default IntegrationManager;
