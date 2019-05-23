import {getVectorConfig} from '../getconfig';

function onBackToRiotClick() {
    // Cookie should expire in 4 hours
    document.cookie = 'riot_mobile_redirect_to_guide=false;path=/;max-age=14400';
    window.location.href = '../';
}

// NEVER pass user-controlled content to this function! Hardcoded strings only please.
function renderConfigError(message) {
    const contactMsg = "If this is unexpected, please contact your system administrator " +
        "or technical support representative.";
    message = `<h2>Error loading Riot</h2><p>${message}</p><p>${contactMsg}</p>`;

    const toHide = document.getElementsByClassName("mx_HomePage_container");
    const errorContainers = document.getElementsByClassName("mx_HomePage_errorContainer");

    for (const e of toHide) {
        // We have to clear the content because .style.display='none'; doesn't work
        // due to an !important in the CSS.
        e.innerHTML = '';
    }
    for (const e of errorContainers) {
        e.style.display = 'block';
        e.innerHTML = message;
    }
}

async function initPage() {
    document.getElementById('back_to_riot_button').onclick = onBackToRiotClick;

    let config = await getVectorConfig('..');

    // We manually parse the config similar to how validateServerConfig works because
    // calling that function pulls in roughly 4mb of JS we don't use.

    const wkConfig = config['default_server_config']; // overwritten later under some conditions
    const serverName = config['default_server_name'];
    const defaultHsUrl = config['default_hs_url'];
    const defaultIsUrl = config['default_is_url'];

    const incompatibleOptions = [wkConfig, serverName, defaultHsUrl].filter(i => !!i);
    if (incompatibleOptions.length > 1) {
        return renderConfigError(
            "Invalid configuration: can only specify one of default_server_config, default_server_name, " +
            "or default_hs_url.",
        );
    }
    if (incompatibleOptions.length < 1) {
        return renderConfigError("Invalid configuration: no default server specified.");
    }

    let hsUrl = '';
    let isUrl = '';

    if (wkConfig && wkConfig['m.homeserver']) {
        hsUrl = wkConfig['m.homeserver']['base_url'];

        if (wkConfig['m.identity_server']) {
            isUrl = wkConfig['m.identity_server']['base_url'];
        }
    }

    if (serverName) {
        // We also do our own minimal .well-known validation to avoid pulling in the js-sdk
        try {
            const result = await fetch(`https://${serverName}/.well-known/matrix/client`);
            const wkConfig = await result.json();
            if (wkConfig && wkConfig['m.homeserver']) {
                hsUrl = wkConfig['m.homeserver']['base_url'];

                if (wkConfig['m.identity_server']) {
                    isUrl = wkConfig['m.identity_server']['base_url'];
                }
            }
        } catch (e) {
            console.error(e);
            return renderConfigError("Unable to fetch homeserver configuration");
        }
    }

    if (defaultHsUrl) {
        hsUrl = defaultHsUrl;
        isUrl = defaultIsUrl;
    }

    if (!hsUrl) {
        return renderConfigError("Unable to locate homeserver");
    }

    if (hsUrl && !hsUrl.endsWith('/')) hsUrl += '/';
    if (isUrl && !isUrl.endsWith('/')) isUrl += '/';

    if (hsUrl !== 'https://matrix.org/') {
        document.getElementById('step2_container').style.display = 'block';
        document.getElementById('hs_url').innerText = hsUrl;
        document.getElementById('step_login_header').innerHTML= 'Step 3: Register or Log in';

        if (isUrl && isUrl !== "https://vector.im/") {
            document.getElementById('default_is').style.display = 'none';
            document.getElementById('custom_is').style.display = 'block';
            document.getElementById('is_url').style.display = 'block';
            document.getElementById('is_url').innerText = isUrl;
        }
    }
}

initPage();
