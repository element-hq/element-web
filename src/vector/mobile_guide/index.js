import {getVectorConfig} from '../getconfig';

function onBackToRiotClick() {
    document.cookie = 'mobile_redirect_to_guide=false;path=/';
    window.location.href = '../';
}

async function initPage() {
    document.getElementById('back_to_riot_button').onclick = onBackToRiotClick;

    const config = await getVectorConfig('..');
    let hsUrl = 'https://matrix.org/';
    if (config && config['default_hs_url']) {
        hsUrl = config['default_hs_url'];
    }
    document.getElementById('hs_url').innerHTML = hsUrl;
}

initPage();
