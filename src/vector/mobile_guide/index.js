import {getVectorConfig} from '../getconfig';

function onBackToRiotClick() {
    // Cookie should expire in 4 hours
    document.cookie = 'riot_mobile_redirect_to_guide=false;path=/;max-age=14400';
    window.location.href = '../';
}

async function initPage() {
    document.getElementById('back_to_riot_button').onclick = onBackToRiotClick;

    const config = await getVectorConfig('..');
    let hsUrl;
    if (config && config['base_host_url']) {
        hsUrl = config['base_host_url'];
    }
    if (hsUrl && !hsUrl.endsWith('/')) hsUrl += '/';
    if (hsUrl) {
        document.getElementById('back_to_tchap_image').href = hsUrl;
    }
}

initPage();
