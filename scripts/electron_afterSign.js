const { notarize } = require('electron-notarize');

exports.default = async function(context) {
    const { electronPlatformName, appOutDir } = context;
    if (electronPlatformName !== 'darwin') {
        return;
    }

    // We get the password from keychain. The keychain stores
    // user IDs too, but apparently altool can't get the user ID
    // from the keychain, so we need to get it from the environment.
    const userId = process.env.NOTARIZE_APPLE_ID;
    if (userId === undefined) {
        throw new Exception("User ID not found. Set NOTARIZE_APPLE_ID.");
    }

    const appName = context.packager.appInfo.productFilename;

    return await notarize({
        appBundleId: 'im.riot.app',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: userId,
        appleIdPassword: '@keychain:NOTARIZE_CREDS,
    });
};
