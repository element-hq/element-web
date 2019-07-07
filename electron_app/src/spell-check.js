/*
Copyright 2018 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const { BrowserWindow, ipcMain } = require('electron');
const { webContents } = BrowserWindow;
const jetpack = require('fs-jetpack');
const spellchecker = require('spellchecker');
const path = require('path');
const mem = require('mem');

let app = null;
let enabledDictionaries = [];
let checker = null;
let dictionariesPath = null;
let dictionaries = null;

const loadBundledDictionaries = async () => {
	const embeddedDictionaries = spellchecker.getAvailableDictionaries();
	const directory = jetpack.cwd(
		app.getAppPath(),
		app.getAppPath().endsWith('app.asar') ? '..' : './electron_app',
		'dictionaries',
	);
	const found = await directory.findAsync({ matching: '*.{aff,dic}' });
	const installedDictionaries = found.map((fileName) => path.basename(fileName, path.extname(fileName)));
	dictionariesPath = directory.path();
	dictionaries = Array.from(new Set([...embeddedDictionaries, ...installedDictionaries]))
		.sort()
		.map((x) => x.substring(0, 2));
};

const updateChecker = () => {
	if (enabledDictionaries.length === 0) {
		checker = () => true;
		return;
	}

	if (enabledDictionaries.length === 1) {
		let enabled = false;
		checker = mem((text) => {
			if (!enabled) {
				spellchecker.setDictionary(enabledDictionaries[0], dictionariesPath);
				enabled = true;
			}
			return !spellchecker.isMisspelled(text);
		});
		return;
	}

	const singleDictionaryChecker = mem(
		((dictionariesPath, dictionary, text) => {
			spellchecker.setDictionary(dictionary, dictionariesPath);
			return !spellchecker.isMisspelled(text);
		}).bind(null, dictionariesPath),
	);

	checker = mem(
		((dictionaries, text) => dictionaries.some((dictionary) => singleDictionaryChecker(dictionary, text))).bind(
			null,
			enabledDictionaries,
		),
	);
};

const enable = (...dictionaries) => {
	enabledDictionaries = dictionaries;
	updateChecker();
	return enabledDictionaries.length > 0;
};

const disable = (...dictionaries) => {
	enabledDictionaries = [];
	updateChecker();
};

const isCorrect = (text) => {
	return checker(text);
};

const getCorrections = (text) => {
	text = text.trim();

	if (text === '' || isCorrect(text)) {
		return null;
	}

	return Array.from(
		new Set(
			enabledDictionaries.flatMap((language) => {
				spellchecker.setDictionary(language, dictionariesPath);
				return spellchecker.getCorrectionsForMisspelling(text);
			}),
		),
	);
};

const installDictionary = async (filePath) => {
    console.log('filePath', filePath);
    const name = path.basename(filePath, path.extname(filePath));
    const basename = path.basename(filePath);
    const newPath = path.join(dictionariesPath, basename);

    await jetpack.copyAsync(filePath, newPath);

    if (!dictionaries.includes(name)) {
        dictionaries.push(name);
    }
};

const getDictionariesSelectSubmenu = () => {
	return dictionaries
		.map((entry) => {
			return {
				label: entry,
				type: 'checkbox',
				checked: enabledDictionaries[0] === entry,
			};
		})
		;
};

const getCorrectionsSubmenu = (text) => {
	const corrections = getCorrections(text);
	return [
		...(corrections
			? [
					...(corrections.length === 0
						? [
								{
									label: 'No spelling suggestions',
									enabled: false,
								},
							]
						: corrections.slice(0, 6).map((correction) => ({
								label: correction,
								click: () => webContents.getFocusedWebContents().replaceMisspelling(correction),
							}))),
					...(corrections.length > 6
						? [
								{
									label: 'More spelling suggestions',
									submenu: corrections.slice(6).map((correction) => ({
										label: correction,
										click: () => webContents.getFocusedWebContents().replaceMisspelling(correction),
									})),
								},
							]
						: []),
					{
						type: 'separator',
					},
				]
			: []),
	];
};

const spellCheckMenu = (textForSpellcheck) => {
	const spellingMenu = getCorrectionsSubmenu(textForSpellcheck)
		.concat([{ type: 'separator' }])
		.concat(getDictionariesSelectSubmenu());
	return [
		{
			label: 'Spell Checking',
			enabled: true,
			submenu: spellingMenu,
		},
		{
			type: 'separator',
		},
	];
};

module.exports = async (context) => {
	app = context;
	await loadBundledDictionaries();
	ipcMain.on('spellcheck:getcontextmenu', (event, arg) => {
		event.sender.send('spellcheck:getcontextmenu:result', spellCheckMenu(arg));
	});
	ipcMain.on('spellcheck:setlanguage', (event, arg) => {
		console.log('set language to', arg);
		enable(arg);
		event.sender.send('spellcheck:ready', { ready: true });
	});
	ipcMain.on('spellcheck:disablelanguage', (event, arg) => {
		console.log('disable language', arg);
		disable(arg);
	});
	ipcMain.on('spellcheck:test', (event, arg) => {
		event.returnValue = checker(arg);
	});
	ipcMain.on('spellcheck:ismisspeled', (event, arg) => {
		event.returnValue = isCorrect(arg);
	});
	ipcMain.on('spellcheck:corrections', (event, arg) => {
		event.returnValue = getCorrections(arg);
	});
	ipcMain.on('spellchecker:add', (event, arg) => {
		console.log('customizing spellchecker is not supported yet');
    });
    ipcMain.on('spellchecker:install', (event, arg) => {
        console.log('open selector');
        installDictionary(arg);
    });
};
