// @flow

import ElectronPlatform from './ElectronPlatform';
import WebPlatform from './WebPlatform';

let Platform = null;

if (window && window.process && window.process && window.process.type === 'renderer') {
    // we're running inside electron
    Platform = ElectronPlatform;
} else {
    Platform = WebPlatform;
}

export default Platform;
