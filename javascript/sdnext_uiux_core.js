// Originally from Anapnoe@https://github.com/anapnoe/stable-diffusion-webui-ux/blob/8307896c59032a9cdac1ab24c975102ff9a674d3/extensions-builtin/anapnoe-sd-uiux/javascript/anapnoe_sd_uiux_core.js

localStorage.setItem('UiUxReady', "false");

const template_path = './file=extensions/sdnext-ui-ux/html/templates/';
const uiux_app_id = "#sdnext_app";
const uiux_tab_id = "#tab_sdnext_uiux_core";
const console_js_id = "#console-log-js";

const split_instances = [];
let portalTotal = 0;
let active_main_tab;
let loggerUiUx;
let appUiUx;
let isBackendDiffusers;


//======================= UTILS =======================
function logPrettyPrint() {
	var output = "", arg, i;
		
	output += `<div class="log-row"><span class="log-date">${new Date().toISOString().replace('T',' ').replace('Z','')}</span>`;
	
	for (i = 0; i < arguments.length; i++) {
		arg = arguments[i];
		if (arg === undefined) {
			arg = "undefined";
		}
		if (arg === null) {
			arg = "null";
		}

		const argstr = arg.toString().toLowerCase();
		let acolor = "";

		if (argstr.indexOf("remove") !== -1 || argstr.indexOf("error") !== -1) {
			acolor += " log-remove";
		} else if (argstr.indexOf("loading") !== -1 
				|| argstr.indexOf("register") !== -1 
				|| argstr.indexOf("init") !== -1 
				|| argstr.indexOf("optimiz") !== -1 
				|| argstr.indexOf("python") !== -1  
				|| argstr.indexOf("success") !== -1) {
			acolor += " log-load";
		} else if (argstr.indexOf("[") !== -1) {            
			acolor += " log-object";
		}

		if (arg.toString().indexOf(".css") !== -1 || arg.toString().indexOf(".html") !== -1) {
			acolor += " log-url";
		} else if (arg.toString().indexOf("\n") !== -1) {
			output += "<br />";
		}

		output += `<span class="log-${(typeof arg)} ${acolor}">`;              
		
		if (typeof arg === "object" && typeof JSON === "object" && typeof JSON.stringify === "function") {
			output += JSON.stringify(arg);   
		} else {
			output += arg;   
		}

		output += " </span>";
	}

	output += "</div>";

	return output;
}

async function getContributors(repoName, page = 1) {  
    let request = await fetch(`https://api.github.com/repos/${repoName}/contributors?per_page=100&page=${page}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    let contributorsList = await request.json();
    return contributorsList;
}

async function getAllContributors(repoName, page = 1, allContributors = []) {
    const list = await getContributors(repoName, page);
    allContributors = allContributors.concat(list);

    if (list.length === 100) {
        return getAllContributors(repoName, page + 1, allContributors);
    }

    return allContributors;
}

async function getContributorsMultiple(repoNames) {
	const results = await Promise.all(repoNames.map((repoName) => getAllContributors(repoName)));

	const mergedMap = new Map();
	for (const contributors of results) {
		for (const {login, contributions, ...otherAttributes} of contributors) {
			if (!mergedMap.has(login)) {
				mergedMap.set(login, {login, contributions, ...otherAttributes});
			} else {
				mergedMap.get(login).contributions += contributions;
			}
		}
	}

	const mergedArray = Array.from(mergedMap.values());
	mergedArray.sort((a, b) => b.contributions - a.contributions);
	return mergedArray;
}

function showContributors(){
	const contributors_btn = document.querySelector('#contributors');
	const contributors_view = document.querySelector('#contributors_tabitem');
	const temp = document.createElement('div');
	temp.id = 'contributors_grid';
	temp.innerHTML = `<p>Kindly allow us a moment to retrieve the contributors. We're grateful for the many individuals who have generously put their time and effort to make this possible.</p>`;
	temp.style.display = 'flex';
	temp.style.flexDirection = 'column';
	temp.style.justifyContent = 'center';
	temp.style.alignItems = 'center';	
	temp.style.height = '100%';
	temp.style.whiteSpace = 'normal';
	contributors_view.append(temp);	

	contributors_btn.addEventListener('click', function(e) {
		if(!contributors_btn.getAttribute("data-visited")){
			contributors_btn.setAttribute("data-visited", "true");
			const promise = getContributorsMultiple(["vladmandic/automatic", "BinaryQuantumSoul/sdnext-ui-ux"]);
			promise.then(function (result) {
				temp.innerHTML = "";
				temp.style = "";

				for (let i = 0; i < result.length; i++) {
					const login = result[i].login;
					const html_url = result[i].html_url;
					const avatar_url = result[i].avatar_url;					
					temp.innerHTML += `
					<a href="${html_url}" target="_blank" rel="noopener noreferrer nofollow" class="contributor-button flexbox col">
						<figure><img src="${avatar_url}" lazy="true"></figure>
						<div class="contributor-name">
							${login}
						</div>
					</a>`;
				}										
			})
		}
	});
}


//======================= MOBILE =======================
function applyDefaultLayout(isMobile) {
    appUiUx.querySelectorAll("[mobile]").forEach((tabItem) => {   
        if (isMobile) {
			if(tabItem.childElementCount === 0) {
                const mobile_target = appUiUx.querySelector(tabItem.getAttribute("mobile"));
				if(mobile_target) {
					const target_parent_id = mobile_target.parentElement.id;
					if (target_parent_id) {
						tabItem.setAttribute("mobile-restore", `#${target_parent_id}`);
					} else {
						console.log(`Missing id for parent: ${mobile_target.id}`);
					}
					tabItem.append(mobile_target);
                }
            }
        } else {
            if(tabItem.childElementCount > 0) {               
				const mobile_restore_target = appUiUx.querySelector(tabItem.getAttribute("mobile-restore"));      
				if(mobile_restore_target) {
					tabItem.removeAttribute("mobile-restore");
					mobile_restore_target.append(tabItem.firstElementChild);
				}  
            }
        }           
    });

    if (isMobile) { 
        appUiUx.querySelector(".accordion-vertical.expand #mask-icon-acc-arrow")?.click();
		if (!appUiUx.querySelector(".accordion-vertical.expand #mask-icon-acc-arrow-control")) {
			appUiUx.querySelector(".accordion-vertical #mask-icon-acc-arrow-control").click();
		}

        appUiUx.classList.add("media-mobile");
		appUiUx.classList.remove("media-desktop");
    } else {
        appUiUx.classList.add("media-desktop");
		appUiUx.classList.remove("media-mobile");
    }
}

function switchMobile(){
	function detectMobile() {
		return (window.innerWidth <= 768);
	}

	const optslayout = window.opts.uiux_default_layout;
    if (optslayout === "Auto") {
        window.addEventListener('resize', () => {
			applyDefaultLayout(detectMobile());
		});
        applyDefaultLayout(detectMobile());
    } else if (optslayout === "Mobile") {
        applyDefaultLayout(true);
    } else if (optslayout === "Desktop") {
        applyDefaultLayout(false);
    }   
}


//======================= UIUX READY =======================
function mainTabs(element, tab) {
	const new_tab = document.querySelector(tab);

	if(new_tab) {
		if (active_main_tab) {
			active_main_tab.style.display = 'none';
		}
		new_tab.style.display = 'block';
		active_main_tab = new_tab;
	}
}

function uiuxOptionSettings() {
	// settings max output resolution
	function sdMaxOutputResolution(value) {
		gradioApp().querySelectorAll('[id$="2img_width"] input,[id$="2img_height"] input').forEach((elem) => {
			elem.max = value;
		})
	}
	gradioApp().querySelector("#setting_uiux_max_resolution_output").addEventListener('input', function (e) {
		let intvalue = parseInt(e.target.value);
		intvalue = Math.min(Math.max(intvalue, 512), 16384);
		sdMaxOutputResolution(intvalue);					
	})	
	sdMaxOutputResolution(window.opts.uiux_max_resolution_output);

	// settings input ranges
	function uiux_show_input_range_ticks(value, interactive) {
		if (value) {
			gradioApp().querySelectorAll("input[type='range']").forEach((elem) => {
				let spacing = (elem.step / (elem.max - elem.min)) * 100.0;
				let tsp = "max(3px, calc(" + spacing + "% - 1px))";
				let fsp = "max(4px, calc(" + spacing + "% + 0px))";

				const overlay = `repeating-linear-gradient(90deg, transparent, transparent ${tsp}, var(--sd-input-border-color) ${tsp}, var(--sd-input-border-color) ${fsp})`;
				elem.style.setProperty("--sd-slider-bg-overlay", overlay);
			});
		} else if (interactive) {
			gradioApp().querySelectorAll("input[type='range']").forEach((elem) => {
				elem.style.setProperty("--sd-slider-bg-overlay", "transparent");
			});
		}
	}
	gradioApp().querySelector("#setting_uiux_show_input_range_ticks input").addEventListener("click", function (e) {
		uiux_show_input_range_ticks(e.target.checked, true);
	});
	uiux_show_input_range_ticks(window.opts.uiux_show_input_range_ticks);

	// settings looks
	function setupUiUxSetting(settingId, className) {
		function updateUiUxClass(className, value) {
			if (value) {
				appUiUx.classList.add(className);
			} else {
				appUiUx.classList.remove(className);
			}
		}
		gradioApp().querySelector(`#${settingId} input`).addEventListener("click", function (e) {
			updateUiUxClass(className, e.target.checked);
		});
		updateUiUxClass(className, window.opts[settingId]);
	}

	setupUiUxSetting("setting_uiux_no_slider_layout", "no-slider-layout");
	setupUiUxSetting("setting_uiux_show_labels_aside", "aside-labels");
	setupUiUxSetting("setting_uiux_show_labels_main", "main-labels");
	setupUiUxSetting("setting_uiux_show_labels_tabs", "tab-labels");
	setupUiUxSetting("setting_uiux_show_labels_control", "control-labels");

	// settings mobile scale
	function uiux_mobile_scale(value) {
		const viewport = document.head.querySelector('meta[name="viewport"]');
		viewport.setAttribute("content", `width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=${value}`);      
	}
	gradioApp().querySelector("#setting_uiux_mobile_scale input[type=number]").addEventListener("change", function (e) {
		uiux_mobile_scale(e.target.value);   
	});
	uiux_mobile_scale(window.opts.uiux_mobile_scale);
}

function setupErrorObserver() {
	const console = appUiUx.querySelector('#logMonitorData');
	const consoleBtn = appUiUx.querySelector('#btn_console');
	
	if (console && consoleBtn) {
		observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					var secondTd = node.querySelector('td:nth-child(2)');
					if (secondTd && secondTd.textContent == "ERROR") {
						const errorCountAttr = consoleBtn.getAttribute("error-count");
						const errorCount = errorCountAttr ? parseInt(errorCountAttr) : 0;
						consoleBtn.setAttribute("error-count", errorCount + 1);
					}
				})
			});
		});
		observer.observe(console, {childList: true});

		consoleBtn.addEventListener("click", () => {
			consoleBtn.removeAttribute("error-count");
		});
	}
}

function setupGenerateObservers() {
	const keys = ["#txt2img", "#img2img", "#extras", "#control"];

	keys.forEach((key) => {
		const tgb = document.querySelector(key+'_generate');
		const tib = document.querySelector(key+'_interrupt');
		const tsb = document.querySelector(key+'_skip');
		if (!tgb || !tib || !tsb){
			return;
		}

		const tg = tgb.closest('.sd-button');
		const ti = tib.closest('.portal');
		const ts = tsb.closest('.portal');

		const loop = document.querySelector(key+'_loop');
		if(loop) {
			tib.addEventListener("click", function () {
				loop.classList.add('stop');
			});
		}

		const gen_observer = new MutationObserver(() => {
			if (tgb.textContent && !tgb.querySelector('span')) {
				if (tgb.textContent === "Generate"){
					ti.classList.add('disable');
					ts.classList.add('disable');
					tg.classList.remove('active');

					const icon = document.createElement('div');
					icon.classList.add('mask-icon','icon-generate');
					tgb.appendChild(icon);
				} else {
					ti.classList.remove('disable');
					ts.classList.remove('disable');
					tg.classList.add('active');
				}

				const span = document.createElement('span');
				span.textContent = tgb.textContent;	
				tgb.appendChild(span);
			}
		});
		
		gen_observer.observe(tgb, {childList: true, subtree: true});
	});

	keys.forEach((key) => {
		const teb = document.querySelector(key+'_enqueue');
		if(!teb) {
			return;
		}
		const te = teb.closest('.sd-button');

		const gen_observer = new MutationObserver(() => {
			if (teb.textContent && !teb.querySelector('span')) {
				if (teb.textContent === "Enqueue"){
					te.classList.remove('active');

					const icon = document.createElement('div');
					icon.classList.add('mask-icon','icon-arrow-up-circle-line');
					teb.appendChild(icon);
				} else {
					te.classList.add('active');
				}

				const span = document.createElement('span');
				span.textContent = teb.textContent;	
				teb.appendChild(span);
			}
		});
		
		gen_observer.observe(teb, {childList: true, subtree: true});
	});
}

function attachLoggerScreen() {
	const logger_screen = document.querySelector("#logger_screen");
	if(logger_screen){
		document.querySelector(console_js_id)?.append(loggerUiUx);
		logger_screen.remove();
	}
}

//======================= SETUP =======================
function loadAllPortals() {
	appUiUx.querySelectorAll(`.portal`).forEach((elem, index, array) => {
		const onlyDiffusers = elem.classList.contains("only-diffusers");
		const onlyOriginal = elem.classList.contains("only-original");

		if ((onlyDiffusers && !isBackendDiffusers) || (onlyOriginal && isBackendDiffusers)) {
			portalTotal += 1;
		} else {
			movePortal(elem, 1, index, array.length);
		}
	});
}

function movePortal(portalElem, tries, index, length) {
	const MAX_TRIES = 3;

	const sp = portalElem.getAttribute("data-parent-selector");
	const s = portalElem.getAttribute("data-selector");
	
	let targetElem = document.querySelector(`${sp} ${s}`); //(tries % 2 == 0) ? document.querySelector(`${sp} ${s}`) : appUiUx.querySelector(`${s}`);
	
	if (portalElem && targetElem) {
		console.log("register [try " + tries + "/" + MAX_TRIES + "] | Ref", index, sp, s);

		portalElem.append(targetElem);
		portalTotal += 1;

		const droppable = portalElem.getAttribute('droppable');
		if (droppable) {
			Array.from(portalElem.children).forEach((child) => {
				if (child !== targetElem) {
					if (targetElem.className.indexOf('gradio-accordion') !== -1) {
						targetElem.children[2].append(child);
					} else {
						targetElem.append(child);
					}
				}
			});
		}

		const showButton = portalElem.getAttribute("show-button");
		if (showButton) {
			document.querySelector(showButton)?.classList.remove("hidden");
		}
	} else if (tries < MAX_TRIES) {
		console.log("not found [try " + tries + "/" + MAX_TRIES + "] | Ref", index, sp, s);

		const timeout = portalElem.getAttribute("data-timeout");
		const delay = timeout ? parseInt(timeout) : 500;
		
		setTimeout(() => {
			movePortal(portalElem, tries + 1, index, length);
		}, delay);
	} else {
		console.log("error [try " + tries + "/" + MAX_TRIES + "] | Ref", index, sp, s);

		if(window.opts.uiux_enable_console_log) {
			portalElem.style.backgroundColor = 'pink';
		}
		portalTotal += 1;
	}

	if(portalTotal === length) {				
		localStorage.setItem('UiUxReady', true);
	}
}

function waitForUiUxReady() {
	return new Promise((resolve, reject) => {
		const interval = setInterval(() => {
			if (localStorage.getItem('UiUxReady') === "true") {
				clearInterval(interval);
				resolve();
			}
		}, 500);
	});
}

function initSplitComponents() {
	appUiUx.querySelectorAll(`div.split`).forEach((elem) => {
		let id = elem.id;
		let nid = appUiUx.querySelector(`#${id}`);

		const direction = nid?.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal';
		const gutterSize = nid?.getAttribute('gutterSize') || '8';

		const ids = [], initSizes = [], minSizes = [];
		const containers = appUiUx.querySelectorAll(`#${id} > div.split-container`);
		containers.forEach((c => {
			const ji = c.getAttribute('data-initSize');
			const jm = c.getAttribute('data-minSize');

			ids.push(`#${c.id}`);
			initSizes.push(ji ? parseInt(ji) : 100 / containers.length);
			minSizes.push(jm ? parseInt(jm) : Infinity);
		}));

		console.log("Split component", ids, initSizes, minSizes, direction, gutterSize);

		split_instances[id] = Split(ids, {
			sizes: initSizes,
			minSize: minSizes,
			direction: direction,
			gutterSize: parseInt(gutterSize),
			snapOffset: 0,
			dragInterval: 1,
			elementStyle: function (dimension, size, gutterSize) {
				return {
					'flex-basis': 'calc(' + size + '% - ' + gutterSize + 'px)',
				}
			},
			gutterStyle: function (dimension, gutterSize) {
				return {
					'flex-basis': gutterSize + 'px',
					'min-width': gutterSize + 'px',
					'min-height': gutterSize + 'px',
				}
			},
		});
	});
}

function initAccordionComponents() {
	appUiUx.querySelectorAll(`.accordion-bar`).forEach((elem) => {
		const acc = elem.parentElement;
		const accSplit = acc.closest('.split-container');

		let accTrigger = appUiUx.querySelector(acc.getAttribute('iconTrigger'));
		if (accTrigger) {
			elem.classList.add('pointer-events-none');
		}

		if (acc.className.indexOf('accordion-vertical') !== -1 && accSplit.className.indexOf('split') !== -1) {
			acc.classList.add('expand');

			const splitInstance = split_instances[accSplit.parentElement.id];
			accSplit.setAttribute('data-sizes', JSON.stringify(splitInstance.getSizes()));

			accTrigger?.addEventListener("click", () => {
				acc.classList.toggle('expand');

				if (accSplit.className.indexOf('v-expand') !== -1) {
					accSplit.classList.remove('v-expand');
					accSplit.style.removeProperty("min-width");

					splitInstance.setSizes(JSON.parse(accSplit.getAttribute('data-sizes')));
				} else {
					accSplit.classList.add('v-expand');
					let sizes = splitInstance.getSizes();
					accSplit.setAttribute('data-sizes', JSON.stringify(sizes));

					if (acc.className.indexOf('left') !== -1) {
						sizes[sizes.length-1] = 100;
						sizes[sizes.length-2] = 0;
					} else {
						sizes[sizes.length-1] = 0;
						sizes[sizes.length-2] = 100;
					}

					const padding = parseFloat(window.getComputedStyle(elem, null).getPropertyValue('padding-left')) * 2;
					accSplit.style.minWidth = elem.offsetWidth + padding + "px";

					splitInstance.setSizes(sizes);
				}
			});
		} else {
			accTrigger?.addEventListener("click", () => {acc.classList.toggle('expand')});
		}
	});
}

function initTabComponents() {
	function callToAction(elem) {
		//Expand closest accordion
		const accBar = elem.closest(".accordion-bar");
		if (accBar) {
			const acc = accBar.parentElement;
			if (acc.className.indexOf('expand') === -1) {
				let accTrigger = appUiUx.querySelector(acc.getAttribute('iconTrigger'));
				if (accTrigger) {
					accTrigger.click();
				} else {
					accBar.click();
				}
			}
		}

		//No idea what it's supposed to do, but makes ui extremely slow
		// const pid = elem.getAttribute("data-click");
		// const txt = elem.querySelector('span')?.innerHTML.toLowerCase();
		// if (txt && pid) {	
		// 	console.log("callToAction", txt, pid)			
		// 	document.querySelectorAll(`${pid} .tab-nav button, [data-parent-selector="${pid}"] .tab-nav button`).forEach(function (el) {
		// 		if (el.innerHTML.toLowerCase().indexOf(txt) !== -1) {
		// 			el.click();
		// 		}
		// 	});
		// }
	}

	function hideActive(tab) {
		tab.classList.remove('active');
		const tabItemId = tab.getAttribute("tabItemId");
		appUiUx.querySelectorAll(tabItemId).forEach((tabItem) => {
			tabItem.classList.remove('fade-in');
			tabItem.classList.add('fade-out');
		});
	}

	function showActive(tab) {
		tab.classList.add('active');
		const tabItemId = tab.getAttribute("tabItemId");
		appUiUx.querySelectorAll(tabItemId).forEach((tabItem) => {
			tabItem.classList.add('fade-in');
			tabItem.classList.remove('fade-out');
		});
	}

	appUiUx.querySelectorAll(`.xtabs-tab`).forEach((elem) => {
		elem.addEventListener('click', () => {
			const tabParent = elem.parentElement;
			const tabGroup = elem.getAttribute("tabGroup");

			if (tabGroup) {
				appUiUx.querySelectorAll(`[tabGroup="${tabGroup}"]`).forEach((tab) => {
					if (tab.className.indexOf('active') !== -1) {
						hideActive(tab);
					}
				});
			} else if (tabParent) {
				Array.from(tabParent.children).forEach((tab) => {
					if (tab.className.indexOf('active') !== -1) {
						hideActive(tab);
					}
				});
			}

			showActive(elem);
			callToAction(elem);
		});

		const active = elem.getAttribute("active");
		if (!active) {
			hideActive(elem);
		}
	});

	appUiUx.querySelectorAll(`.xtabs-tab[active]`).forEach((elem) => {
		showActive(elem);
		callToAction(elem);
	});

	function showHideAnchors(anchor, index) {
		Array.from(anchor.children).forEach((elem) => {
			if (elem.matches(`[anchor*="${index}"]`)) {
				elem.style.display = 'flex';
			} else {
				elem.style.display = 'none';
			}
		});
	}

	appUiUx.querySelectorAll(`.xtabs-anchor`).forEach((anchor) => {
		const tabNav = document.querySelector(anchor.getAttribute('anchorNav'));
		if (tabNav) {
			const observer = new MutationObserver(() => {
				const index = Array.from(tabNav.children).findIndex((btn) => btn.classList.contains('selected')) + 1;
				showHideAnchors(anchor, index);
			});
			observer.observe(tabNav, {attributes: true, attributeFilter: ['class'], childList: true});			
		}

		showHideAnchors(anchor, 1);
	});
}

function initButtonComponents() {
	appUiUx.querySelectorAll(`.sd-button`).forEach((elem) => {
		const toggle = elem.getAttribute("toggle");
		const active = elem.getAttribute("active");
		const input = elem.querySelector('input');

		if (input) {
			if (input.checked === true && !active) {
				input.click();
			} else if (input.checked === false && active) {
				input.click();
			}
		}

		if (active) {
			elem.classList.add('active');
		} else {
			elem.classList.remove('active');
		}

		if (toggle) {
			elem.addEventListener('click', (e) => {					
				const input = elem.querySelector('input');				
				if (input) {
					input.click();
					if (input.checked === true) {
						elem.classList.add('active');
					} else if (input.checked === false) {
						elem.classList.remove('active');
					}
				} else {
					elem.classList.toggle('active');
				}
			});
		}

		//Useful to switch tab after button click
		const extraClicks = elem.getAttribute("data-click");
		if(extraClicks){
			elem.addEventListener('click', () => {
				document.querySelectorAll(extraClicks).forEach((el) => {
					el.click();
				})	
			})
		}
	});
}

function setupScripts() {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.id = 'splitjs-main';
		script.setAttribute("data-scope", uiux_app_id);

		script.src = 'https://unpkg.com/split.js/dist/split.js';
		script.onload = resolve;
		script.onerror = reject;
		appUiUx.appendChild(script);
	});
}

function setupAnimationEventListeners(){
	const notransition = window.opts.uiux_disable_transitions;

	document.addEventListener('animationstart', (e) => {
		if (e.animationName === 'fade-in') {				
			e.target.classList.remove('hidden');
		}
		if (notransition && e.animationName === 'fade-out') {	
			e.target.classList.add("notransition");		
			e.target.classList.add('hidden');
		}
	});

	document.addEventListener('animationend', (e) => {
		if (e.animationName === 'fade-out') {				
			e.target.classList.add('hidden');
		}
	}); 
}

function extraTweaks() {
	//Control tab remove when original backend
	if (window.opts.sd_backend === 'original') {
		appUiUx.classList.add('backend-original');
		isBackendDiffusers = false;
	} else if (window.opts.sd_backend === 'diffusers') {
		appUiUx.classList.add('backend-diffusers');
		isBackendDiffusers = true;
	}

	//System tab click second tab
	document.querySelectorAll("#system .tab-nav button")[1].click(); 
}

function createButtonsForExtensions() {
	const other_extensions = document.querySelector(`#other_extensions`);
	const other_views = document.querySelector(`#split-left`);

	const no_button_tabs = [
		"tab_txt2img", "tab_img2img", "tab_process", "tab_control", "tab_interrogate", "tab_train", "tab_models", "tab_extensions", "tab_system", "tab_image_browser",
    	"tab_ui_theme", "tab_anapnoe_dock",
    	"tab_sdnext_uiux_core"
	]

	const snakeToCamel = str => str.replace(/(_\w)/g, match => match[1].toUpperCase());

	document.querySelectorAll(`#tabs > .tabitem`).forEach((c) => {
		const cid = c.id;
		const nid = cid.split('tab_')[1];

		if(!no_button_tabs.includes(cid)) {
			const temp = document.createElement('div');

			temp.innerHTML= `
				<button 
					tabItemId="#split-app, #${cid}_tabitem" 
					tabGroup="main_group" 
					data-click="#tabs" 
					onclick="mainTabs(this, '#${cid}')" 
					class="xtabs-tab"
				>
					<div class="icon-letters">${nid.slice(0, 2)}</div>
					<span>${snakeToCamel(nid)}</span>
				</button>
			`;
			other_extensions.append(temp.firstElementChild);

			temp.innerHTML= `
				<div id="${cid}_tabitem" class="xtabs-item other">
					<div data-parent-selector="gradio-app" data-selector="#${cid} > div" class="portal">
					</div>
				</div>
			`;
			other_views.append(temp.firstElementChild);
		}
	});
}

//======================= TEMPLATES =======================
function replaceRootTemplate() {
	appUiUx = document.querySelector(uiux_app_id);
	gradioApp().insertAdjacentElement('afterbegin', appUiUx);
	active_main_tab = document.querySelector("#tab_txt2img");
}

function getNestedTemplates(container) {
	const nestedData = [];	
	container.querySelectorAll(`.template:not([status])`).forEach((el) => {
		const url = el.getAttribute('url');
		const key = el.getAttribute('key');
		const template = el.getAttribute('template');

		nestedData.push({
			url: url ? url : template_path,
			key: key ? key : undefined,
			template: template ? `${template}.html` : `${el.id}.html`,
			id: el.id
		});
	});
	return nestedData;
}

async function loadCurrentTemplate(data) {
	const curr_data = data.shift();

	if (curr_data) {
        let target;

        if (curr_data.parent) {
            target = curr_data.parent;
        } else if (curr_data.id) {
            target = document.querySelector(`#${curr_data.id}`);
        }

        if (target) {
			console.log('Loading template', curr_data.template);
			const response = await fetch(`${curr_data.url}${curr_data.template}`);

			if (!response.ok) {
				console.log('Failed to load template', curr_data.template);
				target.setAttribute('status', 'error');
			}
			else
			{
				const text = await response.text();
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = curr_data.key ? text.replace(/\s*\{\{.*?\}\}\s*/g, curr_data.key) : text;

				const nestedData = getNestedTemplates(tempDiv);
				data.push(...nestedData);

				target.setAttribute('status', 'true');
				target.append(tempDiv.firstElementChild);
			}

			return loadCurrentTemplate(data);
        }
    }

	return Promise.resolve();
}

async function loadAllTemplates() {
	const data = [
		{
			url: template_path,
			template: 'template-app-root.html',
			parent: document.querySelector(uiux_tab_id)
		}
	];

	await loadCurrentTemplate(data);
	console.log('Template files merged successfully');
}

function removeStyleAssets(){
	console.log("Starting optimizations");

	//Remove specific stylesheets
	document.querySelectorAll(`
		[rel="stylesheet"][href*="/assets/"], 
		[rel="stylesheet"][href*="theme.css"],
		[rel="stylesheet"][href*="file=style.css"]
	`).forEach(stylesheet => {
		stylesheet.remove();
		console.log("Removed stylesheet", stylesheet.getAttribute("href"));  
	});

	//Remove inline styles and svelte classes
	const stylers = document.querySelectorAll('.styler, [class*="svelte"]:not(input)');
	let count = 0;
	let removedCount = 0;

	stylers.forEach(element => {
		if (element.style.display !== "none" && element.style.display !== "block") {
			element.removeAttribute("style");
			removedCount++;
		}

		[...element.classList].filter(className => className.match(/^svelte.*/)).forEach(svelteClass => {
			element.classList.remove(svelteClass);
		});

		count++;
	});

	console.log("Removed inline styles and svelte classes from DOM elements:", "Total Elements:", count, "Removed Elements:", removedCount);
	console.log("Finishing optimizations");
}

//======================= INITIALIZATION =======================
function setFavicon() {
	let link = document.querySelector("link[rel~='icon']");
	if (!link) {
		link = document.createElement('link');
		link.rel = 'icon';
		document.head.appendChild(link);
	}
	link.href = './file=extensions/sdnext-ui-ux/html/favicon.svg';
}

function startLogger() {
	console.log(navigator.userAgent);

	console.log("==== SETTINGS ====");
    console.log("Debug log enabled: ", window.opts.uiux_enable_console_log);
    console.log("Maximum resolution output: ", window.opts.uiux_max_resolution_output);
    console.log("Ignore overrides: ", window.opts.uiux_ignore_overrides);
    console.log("Show ticks for input range slider: ", window.opts.uiux_show_input_range_ticks);
    console.log("Default layout: ", window.opts.uiux_default_layout);
    console.log("Disable transitions: ", window.opts.uiux_disable_transitions);
    console.log("Aside labels: ", window.opts.uiux_show_labels_aside);
    console.log("Main labels: ", window.opts.uiux_show_labels_main);
    console.log("Tabs labels: ", window.opts.uiux_show_labels_tabs);

	if(navigator.userAgent.toLowerCase().includes('firefox')){
		console.log("Go to the Firefox about:config page, then search and toggle layout. css.has-selector. enabled")
	}

    if(!window.opts.uiux_enable_console_log){
        console.log = console.old;
    }
}

function setupLogger() {
	//create logger
	const loggerScreen = document.createElement('div');
	loggerScreen.id = "logger_screen";
	loggerScreen.style = `
		position: fixed; 
		inset: 0; 
		background-color: black; 
		z-index: 99999;
		display: flex;
		flex-direction: column;
		overflow: auto;
	`;
	
	loggerUiUx = document.createElement('div');
	loggerUiUx.id = "logger";

	loggerScreen.append(loggerUiUx);
	document.body.append(loggerScreen);


	//override console.log
	const logger = document.getElementById("logger")

	console.old = console.log;
	console.log = function () {
		logger.innerHTML += logPrettyPrint(...arguments);
		console.old(...arguments);
	};
}

//======================= MAIN ROUTINE =======================
async function mainUiUx() {
	setupLogger();

	//INITIALIZATION
	console.log("Initialize SDNext UiUx");
	startLogger();

	setFavicon();
	removeStyleAssets();
	await loadAllTemplates();
	replaceRootTemplate();

	//SETUP
	console.log("Init runtime components");

	createButtonsForExtensions();
	extraTweaks();
	setupAnimationEventListeners();
	await setupScripts();
	initSplitComponents();
	initAccordionComponents();
	loadAllPortals();
	initTabComponents();
	initButtonComponents();
	attachLoggerScreen();
	await waitForUiUxReady();

	//UIUX READY
	console.log("Runtime components initialized");

	attachLoggerScreen();
	setupGenerateObservers();
	setupErrorObserver();
	uiuxOptionSettings();
	showContributors();      
	switchMobile();

	//UIUX COMPLETE
	console.log("UiUx complete");
}

document.addEventListener("DOMContentLoaded", () => {
	const observer = new MutationObserver(() => {
		const block = gradioApp().querySelector(uiux_tab_id);			
		
		if (block && window.opts && Object.keys(window.opts).length) {
			observer.disconnect();
			setTimeout(() => {
				mainUiUx();
			}, 1000);
		}
	});
	observer.observe(gradioApp(), {childList: true, subtree: true});
});