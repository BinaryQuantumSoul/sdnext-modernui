0: "#txt2img_styles_edit_button"
1: "#txt2img_style_apply"
2: "#txt2img_token_counter.block"
3: "#txt2img_negative_token_counter.block"
4: "#txt2img_dimensions_row"
5: "#txt2img_subseed_show"
6: "#txt2img_seed_extras"
7: "#txt2img_enable"
8: "#txt2img_hr"
9: "#layout-txt2img  .gradio-accordion:has( div[id^='setting_'])"
10: "#txt2img_container_aspect_ratio"
11: "#txt2img_script_container"
12: "#phystonPrompt_txt2img_prompt"
13: "#phystonPrompt_txt2img_neg_prompt"
<!-- 14: "#txt2img_open_folder" -->
15: "#save_zip_txt2img"
<!-- 16: "#txt2img_send_to_inpaint"
17: "#txt2img_send_to_extras"
18: "#txt2img_send_to_img2img" -->
<!-- 19: "#img2img_tools #paste"
20: "#img2img_clear_prompt" -->
21: "#img2img_styles_edit_button"
22: "#img2img_style_apply"
23: "#img2img_token_counter.block"
24: "#img2img_negative_token_counter.block"
<!-- 25: "#interrogate"
26: "#deepbooru" -->
<!-- 27: "#resize_mode" -->
28: "#img2img_dimensions_row"
29: "#img2img_subseed_show"
30: "#img2img_seed_extras"
31: "#img2img_enable"
32: "#layout-img2img .gradio-accordion:has( div[id^='setting_'])"
33: "#img2img_container_aspect_ratio"
34: "#phystonPrompt_img2img_prompt"
35: "#phystonPrompt_img2img_neg_prompt"
36: "#img2img_column_size .tab-nav"
37: "#img2img_gallery_container"
<!-- 38: "#img2img_open_folder" -->
39: "#save_zip_img2img"
<!-- 40: "#img2img_send_to_inpaint" -->
<!-- 41: "#img2img_send_to_extras" -->
<!-- 42: "#img2img_send_to_img2img" -->
<!-- 43: "#tab_extras" -->
<!-- 44: "#extras_open_folder" -->
<!-- 45: "#extras_send_to_inpaint" -->
<!-- 46: "#extras_send_to_extras" -->
<!-- 47: "#extras_send_to_img2img" -->
48: "#html_info_x_extras"
49: "#tab_train > div"
50: "#ti_gallery"
51: "#ti_output"
52: "#ti_progress"
53: "#ti_error"
54: ".global-popup-inner"
<!-- 55: "#tab_extras > div" -->
56: "#tab_interrogate > div"
57: "#tab_models > div"
58: "#tab_agent_scheduler > div"
59: "#tab_image_browser > div"
60: "#tab_system > div"
61: "#txt2img_checkpoints_subdirs"
62: "#txt2img_checkpoints_cards"
63: "#txt2img_textual_inversion_subdirs"
64: "#txt2img_textual_inversion_cards"
65: "#txt2img_hypernetworks_subdirs"
66: "#txt2img_hypernetworks_cards"
67: "#pnginfo_image"
68: "#tab_pnginfo textarea"
69: "#tabs_extensions .tab-nav"
70: "#settings_restart_gradio"
71: "#tab_settings .tab-nav"
72: "#tab_settings > div"
73: "#modelmerger_merge"
74: "#modelmerger_interp_description"
75: "#modelmerger_primary_model_name"
76: "#modelmerger_secondary_model_name"
77: "#modelmerger_tertiary_model_name"
78: "#modelmerger_custom_name"
79: "#modelmerger_interp_amount"
80: "#modelmerger_interp_method"
81: "#modelmerger_checkpoint_format"
82: "#modelmerger_save_as_half"
83: "#modelmerger_config_method"
84: "#modelmerger_bake_in_vae"
85: "#modelmerger_discard_weights"
86: "#tab_modelmerger .gradio-accordion"
87: "#modelmerger_results_container"
88: "#tab_ui_theme > div"
(() => {
  const elements = document.querySelectorAll('[data-selector]');
  const filteredElements = Array.from(elements).filter(element => {
    const selector = element.getAttribute('data-selector');
    const childElement = element.querySelector(selector);
    return ! (childElement && childElement.id === selector.substring(1));
  });
  filteredElements.forEach(element => {
    element.style.backgroundColor = 'pink';
  });
  return filteredElements.map(element => element.getAttribute('data-selector'));
})();
