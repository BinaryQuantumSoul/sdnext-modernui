localStorage.setItem('UiUxReady', "false");
localStorage.setItem('UiUxComplete', "false");

const template_path = './file=extensions/sdnext-ui-ux/html/templates/';
const anapnoe_app_id = "#anapnoe_app";
const anapnoe_tab_id = "#tab_anapnoe_sd_uiux_core";

const split_instances = [];
let total = 0;
let active_main_tab;
let loggerUiUx;
let anapnoe_app;

//======================= UTILS =======================
function logPrettyPrint() {
	var output = "", arg, i;
		
	output += `<div class="log-row"><span class="log-date">${new Date().toLocaleString().replace(',','')}</span>`;
	
	for (i = 0; i < arguments.length; i++) {
		arg = arguments[i] || "undefined";
		const argstr = arg.toString().toLowerCase();
		let acolor = "";

		if (argstr.indexOf("remove") !== -1 || argstr.indexOf("error") !== -1) {
			acolor += " log-remove";
		} else if (argstr.indexOf("loading") !== -1 
				|| argstr.indexOf("| ref") !== -1 
				|| argstr.indexOf("initial") !== -1 
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

async function getAllContributorsRecursive(repoName, page = 1, allContributors = []) {
    const list = await getContributors(repoName, page);
    allContributors = allContributors.concat(list);

    if (list.length === 100) {
        return getAllContributorsRecursive(repoName, page + 1, allContributors);
    }

    return allContributors;
}

function showContributors(){
	const contributors_btn = document.querySelector('#contributors');
	const contributors_view = document.querySelector('#contributors_tabitem');
	const temp = document.createElement('div');
	temp.id = 'contributors_grid';
	temp.innerHTML = `<p>Kindly allow us a moment to retrieve the contributors. 
	We're grateful for the many individuals who have generously put their time and effort to make this possible.</p>`;
	temp.style.display = 'flex';
	temp.style.flexDirection = 'column';
	temp.style.justifyContent = 'center';
	temp.style.alignItems = 'center';	
	temp.style.height = '100%';
	contributors_view.append(temp);	

	contributors_btn.addEventListener('click', function(e) {
		if(!contributors_btn.getAttribute("data-visited")){
			contributors_btn.setAttribute("data-visited", "true");
			const promise = getAllContributorsRecursive("vladmandic/automatic");
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

async function getReadMeContent() {
    try {
		const response = await fetch('https://raw.githubusercontent.com/vladmandic/automatic/master/README.md');
		if (!response.ok) {
			throw new Error();
		}
		return marked.parse(await response.text());
	} catch (error) {
		return `
			<p>Error loading content. Please checkout our <a title="Github" target="_blank" href="https://github.com/vladmandic/automatic">Github</a>.</p>
			<p>${error}</p>
		`;
	}
}

function showReadMeAbout() {
    const about_btn = document.querySelector("#readme_about");
    about_btn.addEventListener('click', function(){
        if(!about_btn.getAttribute("data-visited")){
            about_btn.setAttribute("data-visited", "true");

            getReadMeContent().then(content => {
				document.getElementById('about-content').innerHTML = content;
			});
        }
    });
}

//======================= EXTRA_NETWORKS =======================
//var orig_all_gallery_buttons = window.all_gallery_buttons;
window.all_gallery_buttons = function(){
    //orig_all_gallery_buttons();
	var tabitem = gradioApp().querySelector('#main-nav-bar button.active')?.getAttribute('tabitemid');
	var visibleGalleryButtons = [];
	if(tabitem){
		//console.log(tabitem, allGalleryButtons);
		var allGalleryButtons = gradioApp().querySelectorAll(tabitem+' .gradio-gallery .thumbnails > .thumbnail-small');
		allGalleryButtons?.forEach(function(elem) {
			if (elem.parentElement.offsetParent && elem.parentElement.offsetParent !== document.body) {               
				visibleGalleryButtons.push(elem);
			}
		});
	}
	return visibleGalleryButtons;
}

window.extraNetworksSearchButton = function(tabs_id, e) {
	var  button = e.target;
	const attr = e.target.parentElement.parentElement.getAttribute("search-field"); 
    var searchTextarea = gradioApp().querySelector(attr);
	//console.log(button, searchTextarea)
	var text = button.classList.contains("search-all") ? "" : button.textContent.trim();
	searchTextarea.value = text;
	window.updateInput(searchTextarea);
}

window.imageMaskResize = function(){
	// override function empty we dont need any fix here
}

window.extraNetworksEditUserMetadata = function(event, tabname, extraPage, cardName) {
    //var id = tabname + '_' + extraPage + '_edit_user_metadata';
	var tid = 'txt2img_' + extraPage + '_edit_user_metadata';
    var editor = extraPageUserMetadataEditors[tid];
    if (!editor) {
        editor = {};
        editor.page = gradioApp().getElementById(tid);
        editor.nameTextarea = gradioApp().querySelector("#" + tid + "_name" + ' textarea');
        editor.button = gradioApp().querySelector("#" + tid + "_button");
        extraPageUserMetadataEditors[tid] = editor;
    }

    editor.nameTextarea.value = cardName;
    updateInput(editor.nameTextarea);

    editor.button.click();

    popup(editor.page);

    //event.stopPropagation();
}

window.get_uiCurrentTabContent = function(){
    //console.log(active_main_tab);
    if(active_main_tab.id === "tab_txt2img"){
        return document.getElementById("txt2img_tabitem");
    }else if(active_main_tab.id === "tab_img2img"){
        return document.getElementById("img2img_tabitem");
    }
}

function testpopup(){
	const content_div = document.querySelector('#popup_tabitem');
	//const meta_id = document.querySelector('.global-popup-inner > div')?.id;
	content_div.querySelectorAll(`.portal`).forEach((el, index, array) => {				
		/*
		const childs = Array.from(el.children);
		childs.forEach((c) => {
			const ac = c.getAttribute("meta-Id");	
			if(ac){
				if(ac === meta_id){
					c.style.display = "";
					el.style.display = "";										
					
				}else{
					c.style.display = "none";
					if(childs.length === 1){
						el.style.display = "none";						
					}
				}
			}else{
				c.setAttribute("meta-id", meta_id);
			}
		}); 
		*/
		setAttrSelector(el, content_div, 0, index, array.length);
	});

	/* 	
	content_div.querySelectorAll(`.ae-popup .edit-user-metadata-buttons button`).forEach((el) => {
	} 
	*/
}

function setupExtraNetworksSearchSort(){

	const applyFilter = function(e) {
        const search_term = e.target.value.toLowerCase();
		const cards = e.target.getAttribute("data-target"); 
		//console.log(search_term, cards )
        gradioApp().querySelectorAll(cards).forEach(function(elem) {
            //const text = elem.querySelector(".search_term").textContent;//elem.getAttribute("data-path").toLowerCase().split("\\").join("/");
			const text = elem.querySelector('.name').textContent.toLowerCase() + " " + elem.querySelector('.search_term').textContent.toLowerCase();
			let visible = text.indexOf(search_term) != -1;
			if (search_term.length < 3) {			
                visible = true;
            }
            elem.style.display = visible ? "" : "none";
        });
    };

	document.querySelectorAll('.search_extra_networks').forEach((el) => {
		el.addEventListener("input", applyFilter);
	})
	  
	function applySort(el, sortKey) { 

		function comparator(cardA, cardB) { 
			var a = cardA.getAttribute(sortKey);
			var b = cardB.getAttribute(sortKey);
			if (!isNaN(a) && !isNaN(b)) {
				return parseInt(a) - parseInt(b);
			}	
			return (a < b ? -1 : (a > b ? 1 : 0));
		} 

		const cards_selector = el.getAttribute("data-target"); 
		const cards = gradioApp().querySelectorAll(cards_selector); 
		const cards_parent = cards[0].parentElement;	
		const cardsArray = Array.from(cards); 
		let sorted = cardsArray.sort(comparator);

		const reverse_button = el.nextElementSibling;//closest(".reverse-order");
		const reverse = reverse_button.className.indexOf("active") !== -1;
		if (reverse) {
            sorted.reverse();
        }
		sorted.forEach(e => cards_parent.appendChild(e)); 

	} 
	
	document.querySelectorAll('.extra_networks_order_by').forEach((el) => {	
		el.addEventListener('change', function(e) {
			applySort(e.target, this.value);
			//console.log('You selected: ', this.value);
		});
		el.nextElementSibling.addEventListener('click', function(e) {
			applySort(el, el.value);	
			console.log('You selected: ', el.value);
		});
	})

}

function updateExtraNetworksCards(el){

	console.log("Starting optimizations for", el.id);
	el.querySelectorAll(".card, .card-button").forEach((card) => {
		const onclick_data = card.getAttribute("onClick");
		card.setAttribute("data-apply", onclick_data);			
		card.removeAttribute("onClick");
		if(card.getAttribute("data-name")){
			console.log("Remove EventListener", card.getAttribute("data-name"))
		}else{
			const card_closest = card.closest(".card");			
			console.log("Remove EventListener", `${card_closest.getAttribute("data-name")} - ${card.getAttribute("title")}`)
		}
					
	})
	
	console.log("Attach EventListener", el.id);
	el.addEventListener("click", function(e) {
		const ctarget = e.target;				
		if(ctarget && ctarget.className.indexOf("card") !== -1) {
			let data_apply = ctarget.getAttribute("data-apply");
			if(!data_apply){
				const onclick_data = ctarget.getAttribute("onClick");
				if(onclick_data){
					ctarget.setAttribute("data-apply", onclick_data);			
					ctarget.removeAttribute("onClick");
				}
			}

			const tabkey = active_main_tab.id.split("tab_")[1];
			if(tabkey === "img2img"){
				data_apply = data_apply?.replace("txt2img", "img2img");
			}else{
				data_apply = data_apply?.replace("img2img", "txt2img");
			}
			
			ctarget.setAttribute("onClick", data_apply );
			ctarget.click();					
			ctarget.removeAttribute("onClick");

			if(ctarget.className.indexOf("card-button") !== -1){						
				data_apply = data_apply?.replace("img2img", "txt2img");
				popup_trigger.click();					
				testpopup();
			}

		}
	})

	document.querySelectorAll("#txt2img_styles_edit_button, #img2img_styles_edit_button").forEach((elm) => {
		elm.addEventListener("click", function(e) {
			popup_trigger.click();					
			testpopup();	
		})
	})
	
	

}

function initExtraNetworks() {
	const content_div = anapnoe_app;
	
	console.log("Starting optimizations for Extra Networks");

	content_div.querySelectorAll(".extra-network-cards").forEach((el) => {
		updateExtraNetworksCards(el);
	}); 

	console.log("Finishing optimizations for Extra Networks");

	setupExtraNetworksSearchSort();

	const ch_input = document.querySelector ("#setting_sd_model_checkpoint .secondary-wrap input");
	//const hash_target = document.querySelector('#sd_checkpoint_hash');
	//const hash_old_value = hash_target.textContent;
	const hash_old_value = ch_input.value;
	let oldcard = document.querySelector(`#txt2img_checkpoints_cards .card[data-apply*="${hash_old_value}"]`);
	if(oldcard){
		oldcard?.classList.add("selected");
		console.log("Checkpoint name:", oldcard.getAttribute("data-name"), "<br>");
	}

	const ch_footer_preload = document.querySelector("#txt2img_checkpoints_main_footer .model-preloader");
	const ch_footer_selected = document.querySelector("#txt2img_checkpoints_main_footer .model-selected");
	
	const ch_preload = document.querySelector ("#setting_sd_model_checkpoint .wrap");
	ch_footer_preload.append(ch_preload);	

	const preload_model_observer = new MutationObserver(function (mutations) {
		mutations.forEach(function (m) {
			if(oldcard){
				const hash_target = document.querySelector('#sd_checkpoint_hash');
				const hash_value = hash_target.textContent;
				const card = document.querySelector(`#txt2img_checkpoints_cards .card[data-apply*="${hash_value}"]`);	
				if(card){
					if(oldcard !== card){
						oldcard.classList.remove("selected");
						card.classList.add("selected");
						oldcard = card;	
						ch_footer_selected.textContent = ch_input.value;
						console.log("Checkpoint:", ch_input.value)
					}	
				}					
			}						
		});
	});

	preload_model_observer.observe(ch_preload, { childList: true, subtree: false });
}

//======================= MOBILE =======================
function detectMobile() {
    return (window.innerWidth <= 768);
}

function applyDefaultLayout(isMobile){
    anapnoe_app.querySelectorAll("[mobile]").forEach((tabItem) => {   
        //console.log(tabItem);     
        if(isMobile){
            if(tabItem.childElementCount === 0){
                const mobile_attr = tabItem.getAttribute("mobile");              
                if(mobile_attr){
                    const mobile_target = anapnoe_app.querySelector(mobile_attr);      
                    if(mobile_target){
                        tabItem.setAttribute("mobile-restore", `#${mobile_target.parentElement.id}`);
                        tabItem.append(mobile_target);
                        
                    }           
                }
            }
        }else{
            if(tabItem.childElementCount > 0){
                const mobile_restore_attr = tabItem.getAttribute("mobile-restore");              
                if(mobile_restore_attr){                  
                    const mobile_restore_target = anapnoe_app.querySelector(mobile_restore_attr);      
                    if(mobile_restore_target){
                        mobile_restore_target.append(tabItem.firstElementChild);
                    }           
                }
            }
        }           
    });

    if(isMobile){ 
        anapnoe_app.querySelector(".accordion-vertical.expand #mask-icon-acc-arrow")?.click();
        anapnoe_app.classList.add("default-mobile");
    }else{
        anapnoe_app.classList.remove("default-mobile");
    }
}

function switchMobile(){
    const optslayout = window.opts.uiux_default_layout;
    //console.log(optslayout);
    anapnoe_app.classList.add(`default-${optslayout.toLowerCase()}`);
    if(optslayout === "Auto"){           
        /*  
        window.addEventListener("resize", debounce(function(e){
            const isMobile = detectMobile();
            applyDefaultLayout(isMobile);
        })); 
        */
        window.addEventListener('resize', function(event){
            const isMobile = detectMobile();
            applyDefaultLayout(isMobile);
        });
        applyDefaultLayout(detectMobile());

    }else if(optslayout === "Mobile"){
        applyDefaultLayout(true);
    }else{
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
		//console.log(tab, ntab);
	}
}

function uiuxOptionSettings() {
    // sd max resolution output
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

	// step ticks for performant input range
	function uiux_show_input_range_ticks(value, interactive) {
		if (value) {
			const range_selectors = "input[type='range']";
			//const range_selectors = "[id$='_clone']:is(input[type='range'])";
			gradioApp()
				.querySelectorAll(range_selectors)
				.forEach(function (elem) {
					let spacing = (elem.step / (elem.max - elem.min)) * 100.0;
					let tsp = "max(3px, calc(" + spacing + "% - 1px))";
					let fsp = "max(4px, calc(" + spacing + "% + 0px))";
					var style = elem.style;
					style.setProperty(
						"--ae-slider-bg-overlay",
						"repeating-linear-gradient( 90deg, transparent, transparent " +
						tsp +
						", var(--ae-input-border-color) " +
						tsp +
						", var(--ae-input-border-color) " +
						fsp +
						" )"
					);
				});
		} else if (interactive) {
			gradioApp()
				.querySelectorAll("input[type='range']")
				.forEach(function (elem) {
					var style = elem.style;
					style.setProperty("--ae-slider-bg-overlay", "transparent");
				});
		}
	}
	 
	gradioApp().querySelector("#setting_uiux_show_input_range_ticks input").addEventListener("click", function (e) {
		uiux_show_input_range_ticks(e.target.checked, true);
	});
	uiux_show_input_range_ticks(window.opts.uiux_show_input_range_ticks);


    function remove_overrides(){	
		let checked_overrides = [];
		gradioApp().querySelectorAll("#setting_uiux_ignore_overrides input").forEach(function (elem, i){
			if(elem.checked){
				checked_overrides[i] = elem.nextElementSibling.innerHTML;
			}			
		})
		//console.log(checked_overrides);
		gradioApp().querySelectorAll("[id$='2img_override_settings'] .token").forEach(function (token){
			let token_arr = token.querySelector("span").innerHTML.split(":");
			let token_name = token_arr[0];
			let token_value = token_arr[1];
			token_value = token_value.replaceAll(" ", "");	
			
			/* if(token_name.indexOf("Model hash") != -1){
				const info_label = gradioApp().querySelector("[id$='2img_override_settings'] label span");
				info_label.innerHTML = "Override settings MDL: unknown";
				for (let m=0; m<sdCheckpointModels.length; m++) {						
					let m_str = sdCheckpointModels[m];					
					if(m_str.indexOf(token_value) != -1 ){
						info_label.innerHTML = "Override settings <i>MDL: " +  m_str.split("[")[0] + "</i>";
						break;
					}
				}	
			} */
			if(checked_overrides.indexOf(token_name) != -1){				
				token.querySelector(".token-remove").click();
				gradioApp().querySelector("[id$='2img_override_settings']").classList.add("show");				
			}else{
				// maybe we add them again, for now we can select and add the removed tokens manually from the drop down
			}			
		})
	}
	gradioApp().querySelector("#setting_uiux_ignore_overrides").addEventListener('click', function (e) {
		setTimeout(function() { remove_overrides(); }, 100);		
	})
    /*     
    gradioApp().querySelectorAll("#pnginfo_send_buttons button, #paste").forEach(function (elem) {
      elem.addEventListener("click", function (e) {     
        setTimeout(function () {
            remove_overrides();
        }, 500);
      });
    }); 
    */
    const overrides_observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if(mutation.addedNodes){
                //console.log(mutation.addedNodes.length + ' nodes added');
                setTimeout(function() { remove_overrides(); }, 100);
            }
        });
    });
    
    gradioApp().querySelectorAll("#txt2img_override_settings .wrap-inner, #img2img_override_settings .wrap_inner").forEach(function (elem) {
        overrides_observer.observe(elem, { childList: true });
    }); 
    

    function uiux_no_slider_layout(value) {
        if (value) {
            anapnoe_app.classList.add("no-slider-layout");
        } else {
            anapnoe_app.classList.remove("no-slider-layout");
        }
    }

    gradioApp().querySelector("#setting_uiux_no_slider_layout input").addEventListener("click", function (e) {
        uiux_no_slider_layout(e.target.checked, true);
    });

    uiux_no_slider_layout(window.opts.uiux_no_slider_layout);

    function uiux_show_labels_aside(value) {
        if (value) {
            anapnoe_app.classList.add("aside-labels");
        } else {
            anapnoe_app.classList.remove("aside-labels");
        }
    }
    gradioApp().querySelector("#setting_uiux_show_labels_aside input").addEventListener("click", function (e) {
        uiux_show_labels_aside(e.target.checked, true);
    });
    uiux_show_labels_aside(window.opts.uiux_show_labels_aside);


    function uiux_show_labels_main(value) {
        if (value) {
            anapnoe_app.classList.add("main-labels");
        } else {
            anapnoe_app.classList.remove("main-labels");
        }
    }
    gradioApp().querySelector("#setting_uiux_show_labels_main input").addEventListener("click", function (e) {
        uiux_show_labels_main(e.target.checked, true);
    });
    uiux_show_labels_main(window.opts.uiux_show_labels_main);


    function uiux_show_labels_tabs(value) {
        if (value) {
            anapnoe_app.classList.add("tab-labels");
        } else {
            anapnoe_app.classList.remove("tab-labels");
        }
    }
    gradioApp().querySelector("#setting_uiux_show_labels_tabs input").addEventListener("click", function (e) {
        uiux_show_labels_tabs(e.target.checked, true);
    });
    uiux_show_labels_tabs(window.opts.uiux_show_labels_tabs);

    
    const comp_mobile_scale_range = gradioApp().querySelector("#setting_uiux_mobile_scale input[type=range]");
    comp_mobile_scale_range.classList.add("hidden");
    const comp_mobile_scale = gradioApp().querySelector("#setting_uiux_mobile_scale input[type=number]");
    function uiux_mobile_scale(value) {
        const viewport = document.head.querySelector('meta[name="viewport"]');
        viewport.setAttribute("content", `width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=${value}`);      
    }
    comp_mobile_scale.addEventListener("change", function (e) { 
        //e.preventDefault();
        //e.stopImmediatePropagation()
        comp_mobile_scale.value = e.target.value;
        window.updateInput(comp_mobile_scale);
        console.log('change', e.target.value);
        uiux_mobile_scale(e.target.value);   
    });
    
    uiux_mobile_scale(window.opts.uiux_mobile_scale);
}

function setupGenerateObservers() {
	const keys = ["#txt2img", "#img2img"];
	keys.forEach((key) => {
	 
		const tib = document.querySelector(key+'_interrupt');
		const tgb = document.querySelector(key+'_generate');
		const ti = tib.closest('.portal');
		const tg = tgb.closest('.ae-button');
		const ts = document.querySelector(key+'_skip').closest('.portal');
		const loop = document.querySelector(key+'_loop');

		tib.addEventListener("click", function () {
			loop.classList.add('stop');
		});

		const gen_observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (m) {

				if (tib.style.display === 'none') {

					if (loop.className.indexOf('stop') !== -1 || loop.className.indexOf('active') === -1) {
						loop.classList.remove('stop');
						ti.classList.add('disable');
						ts.classList.add('disable');
						tg.classList.remove('active');
					} else if (loop.className.indexOf('active') !== -1) {
						tgb.click();
					}
				} else {
					ti.classList.remove('disable');
					ts.classList.remove('disable');
					tg.classList.add('active');
				}
			});
		});
		
		gen_observer.observe(tib, { attributes: true, attributeFilter: ['style'] });
	});
}

function attachLoggerScreen() {
	const logger_screen = document.querySelector("#logger_screen");
	if(logger_screen){
		const asideconsole = document.querySelector("#layout-console-log");
		asideconsole.append(loggerUiUx);
		logger_screen.remove();
	}
}

function onUiUxReady() {
	attachLoggerScreen();

	//initExtraNetworks(); disabled

	setupGenerateObservers();
	uiuxOptionSettings();

	showContributors();      
	showReadMeAbout();     
	switchMobile();

	localStorage.setItem('UiUxComplete', true);
	console.log('UiUxComplete');
}

//======================= SETUP =======================
function setAttrSelector(parent_elem, content_div, count, index, length) {

	//const t = parent_elem.getAttribute("data-timeout");
	//const delay = t ? parseInt(t) : 0;
	
	//setTimeout(() => {

	const mcount = count % 2;
	//const parent_elem = this.el;

	const s = parent_elem.getAttribute("data-selector");
	const sp = parent_elem.getAttribute("data-parent-selector");
	

	let target_elem;
	
	switch (mcount) {
		case 0:
			target_elem = document.querySelector(`${sp} ${s}`);
			break;
		case 1:
			target_elem = content_div.querySelector(`${s}`);
			break;
	}

	if (target_elem && parent_elem) {
		parent_elem.append(target_elem);  
		total += 1;
		console.log("register | Ref", index, sp, s);
		const d = parent_elem.getAttribute('droppable');

		if (d) {
			const childs = Array.from(parent_elem.children);
			//console.log("droppable", target_elem, parent_elem, childs);
			childs.forEach((c) => {
				if (c !== target_elem) {
					if (target_elem.className.indexOf('gradio-accordion') !== -1) {
						target_elem.children[2].append(c);
					} else {
						target_elem.append(c);
					}
				}
			});
		}

		const hb = parent_elem.getAttribute("show-button");
		if(hb){document.querySelector(hb)?.classList.remove("hidden");}

	} else if (count < 4) {

		const t = parent_elem.getAttribute("data-timeout");
		const delay = t ? parseInt(t) : 500;
		
		setTimeout(() => {
			console.log( count + 1, "retry | ", delay, " | Ref", index, sp, s);
			setAttrSelector(parent_elem, content_div, count + 1, index, length);
		}, delay);

	} else {
		console.log("error | Ref", index, sp, s);
		total += 1;	

	}

	if(total === length){				
		localStorage.setItem('UiUxReady', true);
		console.log('UiUxReady');
	}

	//}, delay );

}

function initDefaultComponents() {
	const content_div = anapnoe_app;

	content_div.querySelectorAll(`div.split`).forEach((el) => {

		let id = el.id;
		let nid = content_div.querySelector(`#${id}`);

		const dir = nid?.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal';
		const gutter = nid?.getAttribute('gutterSize') || '8';

		const containers = content_div.querySelectorAll(`#${id} > div.split-container`);
		const len = containers.length;
		const r = 100 / len;
		const ids = [], isize = [], msize = [];

		for (let j = 0; j < len; j++) {
			const c = containers[j];
			ids.push(`#${c.id}`);
			const ji = c.getAttribute('data-initSize');
			const jm = c.getAttribute('data-minSize');
			isize.push(ji ? parseInt(ji) : r);
			msize.push(jm ? parseInt(jm) : Infinity);
		}

		console.log("Split component", ids, isize, msize, dir, gutter);

		split_instances[id] = Split(ids, {
			sizes: isize,
			minSize: msize,
			direction: dir,
			gutterSize: parseInt(gutter),
			snapOffset: 0,
			dragInterval: 1,
			//expandToMin: true,         
			elementStyle: function (dimension, size, gutterSize) {
				//console.log(dimension, size, gutterSize);
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
	
	content_div.querySelectorAll(`.portal`).forEach((el, index, array) => {
		setAttrSelector(el, content_div, 0, index, array.length);
	});

	content_div.querySelectorAll(`.accordion-bar`).forEach((c) => {
		const acc = c.parentElement;
		const acc_split = acc.closest('.split-container');

		let ctrg = c;
		const atg = acc.getAttribute('iconTrigger');
		if (atg) {
			const icn = content_div.querySelector(atg);
			if (icn) {
				ctrg = icn;
				c.classList.add('pointer-events-none');
			}
		}

		if (acc.className.indexOf('accordion-vertical') !== -1 && acc_split.className.indexOf('split') !== -1) {

			acc.classList.add('expand');
			//const acc_gutter = acc_split.previousElementSibling;
			const acc_split_id = acc_split.parentElement.id;
			const split_instance = split_instances[acc_split_id];
			acc_split.setAttribute('data-sizes', JSON.stringify(split_instance.getSizes()));

			ctrg?.addEventListener("click", () => {
				acc.classList.toggle('expand');
				//acc_gutter.classList.toggle('pointer-events-none');
				if (acc_split.className.indexOf('v-expand') !== -1) {
					acc_split.classList.remove('v-expand');
					split_instance.setSizes(JSON.parse(acc_split.getAttribute('data-sizes')))
				} else {
					acc_split.classList.add('v-expand');
					let sizes = split_instance.getSizes();
					acc_split.setAttribute('data-sizes', JSON.stringify(sizes));

					//console.log(sizes)
					sizes[sizes.length-1] = 0;
					sizes[sizes.length-2] = 100;

					const padding = parseFloat(window.getComputedStyle(c, null).getPropertyValue('padding-left')) * 2;
					acc_split.style.minWidth = c.offsetWidth+padding+"px";

					split_instance.setSizes(sizes)
				}
			});

		} else {
			ctrg?.addEventListener("click", () => { acc.classList.toggle('expand') });
		}
	});


	function callToAction(el, tids, pid) {

		const acc_bar = el.closest(".accordion-bar");
		if (acc_bar) {
			const acc = acc_bar.parentElement;
			if (acc.className.indexOf('expand') === -1) {
				let ctrg = acc_bar;
				const atg = acc.getAttribute('iconTrigger');
				if (atg) {
					const icn = content_div.querySelector(atg);
					if (icn) {
						ctrg = icn;
					}
				}
				ctrg.click();
			}
		}

		const txt = el.querySelector('span')?.innerHTML.toLowerCase();
		//console.log(txt, pid)
		if (txt && pid) {				
			document.querySelectorAll(`${pid} .tab-nav button, [data-parent-selector="${pid}"] .tab-nav button`).forEach(function (elm) {
				/* console.log(elm.innerHTML, txt) */
				if (elm.innerHTML.toLowerCase().indexOf(txt) !== -1) {
					elm.click();
				}
			});
		}

        
	}

	content_div.querySelectorAll(`.xtabs-tab`).forEach((el) => {

		el.addEventListener('click', () => {
			const tabParent = el.parentElement;
			const tgroup = el.getAttribute("tabGroup");
			const pid = el.getAttribute("data-click");

			function hideActive(tab) {
				tab.classList.remove('active');
				const tids = tab.getAttribute("tabItemId");
				anapnoe_app.querySelectorAll(tids).forEach((tabItem) => {
					//tabItem.classList.add('hidden');
					tabItem.classList.remove('fade-in');
					tabItem.classList.add('fade-out');
				});
			}

			if (tgroup) {
				anapnoe_app.querySelectorAll(`[tabGroup="${tgroup}"]`)
					.forEach((tab) => {
						if (tab.className.indexOf('active') !== -1) {
							hideActive(tab);
						}
					});

			} else if (tabParent) {
				const tabs = [].slice.call(tabParent.children);
				tabs.forEach((tab) => {
					if (tab.className.indexOf('active') !== -1) {
						hideActive(tab);
					}
				});
			}

			const tids = el.getAttribute("tabItemId");
			anapnoe_app.querySelectorAll(tids).forEach((tabItem) => {
				//tabItem.classList.remove('hidden');
				tabItem.classList.remove('fade-out');
				tabItem.classList.add('fade-in');
				//console.log('tab', tids, tabItem);
			});

			el.classList.add('active');
			callToAction(el, tids, pid);

		});

		const active = el.getAttribute("active");
		if (!active) {
			const tids = el.getAttribute("tabItemId");
			anapnoe_app.querySelectorAll(tids).forEach((tabItem) => {
				//tabItem.classList.add('hidden');
				tabItem.classList.remove('fade-in');
				tabItem.classList.add('fade-out');
			});
		}

	});

	content_div.querySelectorAll(`.xtabs-tab[active]`).forEach((el) => {
		el.classList.add('active');
		const tids = el.getAttribute("tabItemId");
		const pid = el.getAttribute("data-click");
		anapnoe_app.querySelectorAll(tids).forEach((tabItem) => {
			//tabItem.classList.remove('hidden');
			tabItem.classList.remove('fade-out');
			tabItem.classList.add('fade-in');
		});
		callToAction(el, tids, pid);
		//console.log('tab', tids, el);
	});

	content_div.querySelectorAll(`.ae-button`).forEach((el) => {
		const toggle = el.getAttribute("toggle");
		const active = el.getAttribute("active");
		const input = el.querySelector('input');

		if (input) {
			if (input.checked === true && !active) {
				input.click();
			} else if (input.checked === false && active) {
				input.click();
			}
		}

		if (active) {
			el.classList.add('active');
		} else {
			el.classList.remove('active');
		}


		if (toggle) {
			el.addEventListener('click', (e) => {					
				const input = el.querySelector('input');				
				if (input) {
					input.click();
					if (input.checked === true) {
						el.classList.add('active');
					} else if (input.checked === false) {
						el.classList.remove('active');
					}
				} else {
					el.classList.toggle('active');
				}
			});
		}

		const adc = el.getAttribute("data-click");
		if(adc){
			el.addEventListener('click', (e) => {

					if(el.className.indexOf("refresh-extra-networks") !== -1){						
					const ctemp = el.closest(".template");
					const ckey = ctemp?.getAttribute("key") || "txt2img";
					//console.log(ckey);
					setTimeout(() => {
						const tempnet = document.querySelector(`#txt2img_temp_tabitem #${ckey}_cards`);
						if(tempnet){
							ctemp.querySelector(".extra-network-cards")?.remove();
							ctemp.querySelector(".extra-network-subdirs")?.remove();
							ctemp.querySelectorAll(`.portal`).forEach((el, index, array) => {
								setAttrSelector(el, ctemp, 0, index, array.length);
							});
							updateExtraNetworksCards(ctemp);
						}
					}, 1000);
					
				}

				//}else{
					document.querySelectorAll(adc).forEach((el) => {
						el.click();
					})	
				//}
			})
		}

	});


	// try to attach Logger Screen to main before full UIUXReady
	const asideconsole = document.querySelector("#layout-console-log");
	asideconsole.append(loggerUiUx);
	document.querySelector("#logger_screen")?.remove();
}

function setupScripts(callback) {
	const content_div = anapnoe_app;

	//markdown
	var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
	content_div.appendChild(script);

	//split views
	var script = document.createElement('script');
	script.id = 'splitjs-main';
	script.setAttribute("data-scope", anapnoe_app_id);
	script.onload = callback;
	script.src = 'https://unpkg.com/split.js/dist/split.js';
	content_div.appendChild(script);
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

function createButtonsForExtensions() {
	const other_extensions = document.querySelector(`#other_extensions`);
	const other_views = document.querySelector(`#split-left`);
	//const other_views = document.querySelector(`#no-split-app`);
	const no_button_tabs = [
		"tab_txt2img", "tab_img2img", "tab_process", "tab_interrogate", "tab_train", "tab_models", "tab_extensions",
    	"tab_ui_theme", "tab_anapnoe_dock",
    	"tab_anapnoe_sd_uiux_core"
	]

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
					<span>${nid}</span>
				</button>
			`;
			other_extensions.append(temp.firstElementChild);
			//console.log(other_extensions, temp.firstElementChild);

			temp.innerHTML= `
				<div id="${cid}_tabitem" class="xtabs-item other">
					<div data-parent-selector="gradio-app" data-selector="#${cid} > div" class="portal">
					</div>
				</div>
			`;
			//console.log(other_views, temp.firstElementChild);
			other_views.append(temp.firstElementChild);
		}
	});
}

function setupUiUxAfterScripts() {
	initDefaultComponents();

	const interval = setInterval(() => {
		if(localStorage.getItem('UiUxReady') === "true") {
			clearInterval(interval);

			console.log("Runtime components initialized");
			onUiUxReady();
		}
	}, 500); 
}

function setupUiUx() {
	console.log("Init runtime components");

	const content_div = document.querySelector(anapnoe_app_id);
	gradioApp().insertAdjacentElement('afterbegin', content_div);
	active_main_tab = document.querySelector("#tab_txt2img");
	anapnoe_app = content_div;

	createButtonsForExtensions();
	setupAnimationEventListeners();
	setupScripts(setupUiUxAfterScripts);
}

//======================= TEMPLATES =======================
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
			parent: document.querySelector(anapnoe_tab_id)
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

function startLogger() {
	console.log("Initialize SDNext UI/UX");
	console.log(navigator.userAgent);

    console.log("Console log enabled: ", window.opts.uiux_enable_console_log);
    console.log("Maximum resolution output: ", window.opts.uiux_max_resolution_output);
    console.log("Ignore overrides: ", window.opts.uiux_ignore_overrides);
    console.log("Show ticks for input range slider: ", window.opts.uiux_show_input_range_ticks);
    console.log("Default layout: ", window.opts.uiux_default_layout);
    console.log("Disable transitions: ", window.opts.uiux_disable_transitions);
    console.log("Aside labels: ", window.opts.uiux_show_labels_aside);
    console.log("Main labels: ", window.opts.uiux_show_labels_main);
    console.log("Tabs labels: ", window.opts.uiux_show_labels_tabs);

	const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
	if(isFirefox){
		console.log("Go to the Firefox about:config page, then search and toggle layout. css.has-selector. enabled")
	}

    if(!window.opts.uiux_enable_console_log){
        console.log = function() {}
    }
}

function setFavicon() {
	let link = document.querySelector("link[rel~='icon']");
	if (!link) {
		link = document.createElement('link');
		link.rel = 'icon';
		document.head.appendChild(link);
	}
	link.href = './file=extensions/sdnext-ui-ux/html/favicon.svg';
}

function initalizeUiUx() {
	setupLogger();
	startLogger();
	setFavicon();

	removeStyleAssets();
	loadAllTemplates().then(setupUiUx);
}

//======================= WAIT FOR INIT =======================
function observeGradioInit() {
	const observer = new MutationObserver(() => {
		const block = gradioApp().querySelector(anapnoe_tab_id);			
		
		if (block && window.opts && Object.keys(window.opts).length) {
			observer.disconnect();
			setTimeout(() => {
				initalizeUiUx();
			}, 1000);
		}
	});
	observer.observe(gradioApp(), { childList: true, subtree: true });
} 

document.addEventListener("DOMContentLoaded", () => {
	observeGradioInit();
});