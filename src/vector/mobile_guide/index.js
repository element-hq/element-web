import {getVectorConfig} from '../getconfig';

function onBackToRiotClick() {
    document.cookie = 'mobile_redirect_to_guide=false;path=/';
    window.location.href = '../';
}

async function initPage() {
    document.getElementById('back_to_riot_button').onclick = onBackToRiotClick;

    const config = await getVectorConfig('..');
    let hsUrl;
    if (config && config['default_hs_url']) {
        hsUrl = config['default_hs_url'];
    }
    if (hsUrl && !hsUrl.endsWith('/')) hsUrl += '/';
    if (hsUrl && hsUrl !== 'https://matrix.org/') {
        document.getElementById('step2_container').style.display = 'block';
        document.getElementById('hs_url').innerHTML = hsUrl;
        document.getElementById('step_login_header').innerHTML= 'Step 3: Register or Log in';
    }
}

initPage();
